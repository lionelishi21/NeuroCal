import path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod, HttpNoneAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Trigger } from "aws-cdk-lib/triggers";
import type { Construct } from "constructs";

export interface NeuroCalStackProps extends StackProps {
  /** "dev", "prod", …; prod keeps data on delete and never pauses the database. */
  stage: string;
  /** Origins allowed to call the API and upload photos (the web app). */
  webOrigins: string[];
  /** Sign-in emails allowed to use the admin routes. */
  adminEmails?: string[];
}

const REPO_ROOT = path.resolve(__dirname, "../..");
const BACKEND = path.join(REPO_ROOT, "backend");

/** API keys the backend reads from the app secret (backend/src/infrastructure/aws/secrets.ts). */
export const APP_SECRET_KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_CSE_API_KEY", "GOOGLE_CSE_ID"] as const;

/**
 * One NeuroCal stage (ARCHITECTURE §1, §9, §10): HTTP API with a Cognito JWT
 * authorizer → API Lambda → Aurora Serverless v2 (Postgres + pgvector), with
 * API keys in Secrets Manager, migrations applied on deploy, and a private
 * photo bucket that clients upload to through presigned URLs.
 */
export class NeuroCalStack extends Stack {
  constructor(scope: Construct, id: string, props: NeuroCalStackProps) {
    super(scope, id, props);
    const prod = props.stage === "prod";
    const retain = prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Network: Lambdas in private subnets with one NAT for OpenAI, Anthropic and Google; the database has no internet route.
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Database: Aurora Serverless v2. Dev pauses when idle (min 0 ACU); prod stays warm.
    const database = new rds.DatabaseCluster(this, "Database", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_17_9 }),
      credentials: rds.Credentials.fromGeneratedSecret("neurocal"),
      defaultDatabaseName: "neurocal",
      writer: rds.ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: prod ? 0.5 : 0,
      serverlessV2MaxCapacity: prod ? 8 : 2,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      storageEncrypted: true,
      backup: { retention: Duration.days(prod ? 14 : 1) },
      deletionProtection: prod,
      removalPolicy: prod ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
    });

    // API keys: one JSON secret. The template only ever holds placeholders; real values are
    // set with `aws secretsmanager put-secret-value` and survive later deploys (infra/README.md).
    const appSecret = new secretsmanager.Secret(this, "AppSecret", {
      description: `NeuroCal ${props.stage} API keys`,
      secretObjectValue: Object.fromEntries(APP_SECRET_KEYS.map((k) => [k, SecretValue.unsafePlainText("set-me")])),
      removalPolicy: retain,
    });

    // Meal photos (presigned upload, ARCHITECTURE §9): private, TLS-only, expire after 30 days (§4).
    const photos = new s3.Bucket(this, "MealPhotos", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(30), abortIncompleteMultipartUploadAfter: Duration.days(1) }],
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: props.webOrigins, allowedHeaders: ["*"], maxAge: 3600 }],
      removalPolicy: retain,
      autoDeleteObjects: !prod,
    });

    // Lambdas share one bundling setup: ESM, arm64, secrets by ARN (never values) in the environment.
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, "LambdaSecurityGroup", { vpc, description: "NeuroCal Lambdas" });
    database.connections.allowDefaultPortFrom(lambdaSecurityGroup, "NeuroCal Lambdas");
    const fn = (name: string, entry: string, extra: Partial<NodejsFunctionProps> = {}) => {
      const f = new NodejsFunction(this, name, {
        entry: path.join(BACKEND, "src/presentation", entry),
        handler: "handler",
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 1024,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSecurityGroup],
        projectRoot: REPO_ROOT,
        depsLockFilePath: path.join(REPO_ROOT, "package-lock.json"),
        environment: {
          STAGE: props.stage,
          APP_SECRET_ARN: appSecret.secretArn,
          DB_SECRET_ARN: database.secret!.secretArn,
          // Trust the RDS CA for sslmode=verify-full.
          NODE_EXTRA_CA_CERTS: "/var/runtime/ca-cert.pem",
          NODE_OPTIONS: "--enable-source-maps",
        },
        logGroup: new logs.LogGroup(this, `${name}Logs`, {
          retention: prod ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        ...extra,
        bundling: {
          format: OutputFormat.ESM,
          target: "node22",
          sourceMap: true,
          // pg and other CommonJS dependencies call require() inside the ESM bundle.
          banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
          // Only the Secrets Manager client comes from the runtime; the S3 client and presigner are bundled.
          externalModules: ["@aws-sdk/client-secrets-manager", "pg-native"],
          ...extra.bundling,
        },
      });
      appSecret.grantRead(f);
      database.secret!.grantRead(f);
      return f;
    };

    const api = fn("ApiFunction", "lambda.ts", { timeout: Duration.seconds(29) });
    // The API signs upload URLs for the bucket and reads uploaded photos; it never lists or deletes.
    api.addEnvironment("PHOTO_BUCKET", photos.bucketName);
    // Sign-in emails allowed to manage products (the admin screen). Not a secret: access still needs that account's sign-in.
    api.addEnvironment("ADMIN_EMAILS", (props.adminEmails ?? []).join(","));
    api.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:PutObject", "s3:GetObject"], resources: [photos.arnForObjects("uploads/*")] }),
    );

    const migrate = fn("MigrateFunction", "migrateLambda.ts", {
      timeout: Duration.minutes(5),
      bundling: {
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          // Ship backend/drizzle (SQL + journal) next to the bundle.
          afterBundling: (inputDir: string, outputDir: string) => [`cp -r "${inputDir}/backend/drizzle" "${outputDir}/drizzle"`],
        },
      },
    });
    // Apply migrations on every deploy that changes them, after the database exists.
    new Trigger(this, "MigrateOnDeploy", { handler: migrate, executeAfter: [database], executeOnHandlerChange: true, timeout: Duration.minutes(5) });

    const catalogSync = fn("CatalogSyncFunction", "syncCatalogLambda.ts", { timeout: Duration.minutes(5) });

    // Auth: Cognito user pool; API Gateway verifies the JWT before the Lambda runs (§10).
    const userPool = new cognito.UserPool(this, "Users", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 10, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: retain,
    });
    const webClient = userPool.addClient("WebClient", {
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    const httpApi = new HttpApi(this, "Api", {
      description: `NeuroCal ${props.stage} API`,
      defaultIntegration: new HttpLambdaIntegration("ApiIntegration", api),
      defaultAuthorizer: new HttpUserPoolAuthorizer("CognitoAuthorizer", userPool, { userPoolClients: [webClient] }),
      corsPreflight: {
        allowOrigins: props.webOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
        allowHeaders: ["authorization", "content-type"],
        maxAge: Duration.hours(1),
      },
    });

    // Browsers send CORS preflights without the token. Without this route they hit the JWT
    // authorizer on $default and get 401, so every cross-origin call fails. API Gateway
    // answers these OPTIONS requests itself with the CORS headers configured above.
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [HttpMethod.OPTIONS],
      integration: new HttpLambdaIntegration("PreflightIntegration", api),
      authorizer: new HttpNoneAuthorizer(),
    });

    // The waitlist is open to anyone: the landing page's visitors have no account. The Lambda
    // serves these two routes without an identity (routes.ts `isPublic`); everything else still
    // goes through the Cognito authorizer on $default.
    const waitlistRoutes = ["/waitlist", "/waitlist/unsubscribe"];
    for (const path of waitlistRoutes) {
      httpApi.addRoutes({
        path,
        methods: [HttpMethod.POST],
        integration: new HttpLambdaIntegration(`Waitlist${path.split("/").length}Integration`, api),
        authorizer: new HttpNoneAuthorizer(),
      });
    }
    // An open form invites floods: a few sign-ups a second is plenty, and the rest get 429.
    (httpApi.defaultStage!.node.defaultChild as CfnStage).routeSettings = Object.fromEntries(
      // Route settings are passed to CloudFormation as written, so the keys take its capitals.
      waitlistRoutes.map((path) => [`POST ${path}`, { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 }]),
    );

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint, description: "NEXT_PUBLIC_API_URL for the web app" });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: webClient.userPoolClientId });
    new CfnOutput(this, "AppSecretArn", { value: appSecret.secretArn, description: "Put the API keys here" });
    new CfnOutput(this, "CatalogSyncFunctionName", { value: catalogSync.functionName, description: "Invoke after catalog changes" });
    new CfnOutput(this, "MealPhotoBucketName", { value: photos.bucketName });
  }
}
