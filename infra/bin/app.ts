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
  // On in cdk.json's context so every deploy keeps it; -c warmDatabase=false lets dev pause again.
  warmDatabase: String(app.node.tryGetContext("warmDatabase")) === "true",
  // -c dbProxy=true|false; unset means on for prod only (it costs ~$85/month).
  ...(app.node.tryGetContext("dbProxy") === undefined ? {} : { dbProxy: String(app.node.tryGetContext("dbProxy")) === "true" }),
  // -c alarmEmail=you@example.com: email alarms for API errors and throttling.
  ...(app.node.tryGetContext("alarmEmail") ? { alarmEmail: String(app.node.tryGetContext("alarmEmail")) } : {}),
  // -c website=true hosts the website (S3 + CloudFront); needs an AWS account verified for CloudFront.
  website: String(app.node.tryGetContext("website")) === "true",
  // -c webUrl=https://neurocal.ai once the domain points at the website; unset, emails link to its CloudFront address.
  ...(app.node.tryGetContext("webUrl") ? { webUrl: String(app.node.tryGetContext("webUrl")) } : {}),
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  tags: { project: "neurocal", stage },
});
