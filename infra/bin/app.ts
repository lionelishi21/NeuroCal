import { App } from "aws-cdk-lib";
import { NeuroCalStack } from "../src/NeuroCalStack";

/**
 * `npm run deploy -w @neurocal/infra -- -c stage=dev -c webOrigins=https://app.example.com`
 * Account and region come from your AWS profile (CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION).
 */
const app = new App();
const stage = (app.node.tryGetContext("stage") as string | undefined) ?? "dev";
const origins = (app.node.tryGetContext("webOrigins") as string | undefined) ?? "http://localhost:3000";

new NeuroCalStack(app, `NeuroCal-${stage}`, {
  stage,
  webOrigins: origins.split(",").map((o) => o.trim()).filter(Boolean),
  // -c adminEmails=you@example.com,other@example.com (or "adminEmails" in cdk.json's context, so every deploy keeps it)
  adminEmails: ((app.node.tryGetContext("adminEmails") as string | undefined) ?? "").split(",").map((e) => e.trim()).filter(Boolean),
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  tags: { project: "neurocal", stage },
});
