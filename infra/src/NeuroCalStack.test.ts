import { describe, expect, it } from "@jest/globals";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { NeuroCalStack } from "./NeuroCalStack";

/** Skip esbuild bundling in tests; `npm run synth` exercises it. */
const synth = (stage: string) => {
  const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new NeuroCalStack(app, `NeuroCal-${stage}`, { stage, webOrigins: ["https://app.example.com"] });
  return Template.fromStack(stack);
};

describe("NeuroCalStack", () => {
  const dev = synth("dev");
  const prod = synth("prod");

  it("runs Aurora PostgreSQL Serverless v2, encrypted and off the internet", () => {
    dev.hasResourceProperties("AWS::RDS::DBCluster", {
      Engine: "aurora-postgresql",
      EngineVersion: Match.stringLikeRegexp("^17\\."),
      StorageEncrypted: true,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 2 },
    });
    dev.hasResourceProperties("AWS::RDS::DBInstance", { PubliclyAccessible: false });
    prod.hasResourceProperties("AWS::RDS::DBCluster", {
      DeletionProtection: true,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 8 },
    });
    prod.hasResource("AWS::RDS::DBCluster", { DeletionPolicy: "Snapshot" });
  });

  it("keeps a dev database awake when asked", () => {
    const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
    const warm = new NeuroCalStack(app, "NeuroCal-warm", { stage: "dev", webOrigins: ["https://app.example.com"], warmDatabase: true });
    Template.fromStack(warm).hasResourceProperties("AWS::RDS::DBCluster", {
      DeletionProtection: false,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 2 },
    });
  });

  it("gives Lambdas secret ARNs, never secret values", () => {
    const functions = dev.findResources("AWS::Lambda::Function", {
      Properties: { Environment: { Variables: { APP_SECRET_ARN: Match.anyValue() } } },
    });
    expect(Object.keys(functions)).toHaveLength(4); // API, migrations, catalog sync, trial reminders
    for (const f of Object.values(functions)) {
      const vars = (f as { Properties: { Environment: { Variables: Record<string, unknown> } } }).Properties.Environment.Variables;
      expect(Object.keys(vars)).not.toEqual(expect.arrayContaining(["OPENAI_API_KEY"]));
      expect(Object.keys(vars)).not.toContain("DATABASE_URL");
      expect(vars).toMatchObject({ NODE_EXTRA_CA_CERTS: "/var/runtime/ca-cert.pem" });
    }
    dev.hasResourceProperties("AWS::Lambda::Function", { Runtime: "nodejs22.x", Architectures: ["arm64"], Timeout: 29 });
  });

  it("puts a Cognito JWT authorizer in front of every API route except preflights, the waitlist and the store webhook", () => {
    dev.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", { AuthorizerType: "JWT", IdentitySource: ["$request.header.Authorization"] });
    dev.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "$default", AuthorizationType: "JWT" });
    // Preflights carry no token, so they must skip the authorizer or browsers block every call.
    dev.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "OPTIONS /{proxy+}", AuthorizationType: "NONE" });
    const routes = Object.values(dev.findResources("AWS::ApiGatewayV2::Route")) as { Properties: { RouteKey: string; AuthorizationType: string } }[];
    // The only open routes: preflights, the landing page's waitlist form and unsubscribe link, and
    // RevenueCat's webhook (which the Lambda checks with a shared secret).
    expect(routes.filter((r) => r.Properties.AuthorizationType === "NONE").map((r) => r.Properties.RouteKey).sort()).toEqual([
      "OPTIONS /{proxy+}",
      "POST /waitlist",
      "POST /waitlist/unsubscribe",
      "POST /webhooks/revenuecat",
    ]);
    // Open routes are rate-limited.
    dev.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      RouteSettings: {
        "POST /waitlist": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
        "POST /waitlist/unsubscribe": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
      },
    });
    dev.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ["https://app.example.com"] }),
    });
  });

  it("keeps meal photos private, TLS-only and expiring after 30 days", () => {
    dev.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 30, Status: "Enabled" })]) },
    });
    dev.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } })]) },
    });
  });

  it("lets only the API Lambda use the photo bucket, and only under uploads/", () => {
    dev.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Environment: { Variables: Match.objectLike({ PHOTO_BUCKET: Match.anyValue(), USER_POOL_ID: Match.anyValue() }) },
    });
    const policies = JSON.stringify(dev.findResources("AWS::IAM::Policy"));
    expect(policies).toContain('["s3:PutObject","s3:GetObject","s3:DeleteObject"]');
    expect(policies).toContain("/uploads/*");
    // Listing (to delete an account's photos) is limited to the uploads/ prefix.
    expect(policies).toContain('"s3:prefix":["uploads/*"]');
    // Nothing broader: no tagging, bucket-wide deletes or wildcards.
    expect(policies.match(/s3:[A-Za-z*]+/g)).toEqual(["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket", "s3:prefix"]);
  });

  it("lets the API delete sign-ins, and nothing else in the user pool", () => {
    const policies = JSON.stringify(dev.findResources("AWS::IAM::Policy"));
    expect(policies.match(/cognito-idp:[A-Za-z*]+/g)).toEqual(["cognito-idp:AdminDeleteUser"]);
  });

  it("creates the waitlist routes before the stage that rate-limits them", () => {
    const stages = Object.values(dev.findResources("AWS::ApiGatewayV2::Stage")) as { DependsOn?: string[] }[];
    const routes = dev.findResources("AWS::ApiGatewayV2::Route");
    const waitlist = Object.entries(routes)
      .filter(([, r]) => /^POST \/waitlist/.test((r as { Properties: { RouteKey: string } }).Properties.RouteKey))
      .map(([id]) => id);
    expect(waitlist).toHaveLength(2);
    expect(stages[0]!.DependsOn).toEqual(expect.arrayContaining(waitlist));
  });

  it("runs the trial reminder job every hour", () => {
    dev.hasResourceProperties("AWS::Events::Rule", { ScheduleExpression: "rate(1 hour)", State: "ENABLED" });
    dev.hasResourceProperties("AWS::Lambda::Function", { Handler: "index.handler", Timeout: 120 });
  });

  it("applies migrations on deploy and keeps prod data on stack deletion", () => {
    dev.resourceCountIs("Custom::Trigger", 1);
    prod.hasResource("AWS::SecretsManager::Secret", { DeletionPolicy: "Retain" });
    prod.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  });
});
