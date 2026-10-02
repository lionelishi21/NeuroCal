# NeuroCal infrastructure (AWS CDK)

One stack per stage deploys the backend: HTTP API with a Cognito JWT authorizer, the API Lambda, Aurora PostgreSQL Serverless v2 with pgvector, Secrets Manager, a migration Lambda that runs on deploy, a catalog-sync Lambda and a private meal-photo bucket. Design notes: `ARCHITECTURE.md` §12.

## Commands

Run from `infra/` (or add `-w @neurocal/infra` from the repo root).

| Command | What it does |
|---|---|
| `npm test` | Checks the stack's security and data-retention settings (no bundling, no AWS account) |
| `npm run synth` | Bundles the three Lambdas with esbuild and writes the templates to `cdk.out/` |
| `npm run diff -- -c stage=dev` | Shows what a deploy would change |
| `npm run deploy -- -c stage=dev` | Deploys `NeuroCal-dev` |

Context options:
- `stage`: `dev` (the default) or `prod`. Any other name behaves like `dev`.
- `webOrigins`: comma-separated origins allowed by CORS. Defaults to `http://localhost:3000`.

## First deploy

1. **AWS credentials and region.** Run `aws configure`, or export a profile. CDK reads `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` from it.
2. **Bootstrap once per account and region:** `npx cdk bootstrap`.
3. **Deploy:**
   ```sh
   npm run deploy -- -c stage=dev -c webOrigins=http://localhost:3000
   ```
   This takes about 15 minutes, mostly for Aurora. Migrations run automatically at the end. The outputs print `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `AppSecretArn` and `CatalogSyncFunctionName`.
4. **Add the API keys.** The secret is created with `set-me` placeholders, and later deploys don't overwrite what you put there:
   ```sh
   aws secretsmanager put-secret-value --secret-id <AppSecretArn> --secret-string '{
     "OPENAI_API_KEY": "sk-…",
     "ANTHROPIC_API_KEY": "sk-ant-…",
     "TAVILY_API_KEY": "tvly-…"
   }'
   ```
   Replace each `…` with the whole real key before running it. `TAVILY_API_KEY` (from https://tavily.com; the free plan covers about 1,000 searches a month, one per recipe suggestion load) powers recipe search; it is not one of the placeholders the stack creates, so it only exists once you add it. `BRAVE_SEARCH_API_KEY`, or `GOOGLE_CSE_API_KEY` with `GOOGLE_CSE_ID`, are read as fallbacks in that order; Google no longer gives new projects access to its API. `RECIPE_ALLOWED_DOMAINS` (comma-separated) is optional.

   Lambdas read the secret once per cold start. After changing keys, force new containers, for example by redeploying or updating any environment value.
5. **Embed the catalog.** Repeat this after every change to `backend/src/infrastructure/catalog/catalog.ts`:
   ```sh
   aws lambda invoke --function-name <CatalogSyncFunctionName> /dev/stdout
   ```

## Calling the API

Every route needs a Cognito ID token in the `Authorization` header. The web app handles this: point it at the stage and sign up in the app (Cognito emails the verification code).

```sh
cd web-poc
NEXT_PUBLIC_API_URL=<ApiUrl> \
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId> \
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId> \
npm run dev
```

The API only accepts calls from the origins in `webOrigins`, so deploy with the web app's origin (for example `http://localhost:3000`). The client only allows SRP sign-in, which is what Amplify Auth (web) and the mobile SDKs use.

## What it costs (rough, us-east-1)

| Item | Dev | Prod |
|---|---|---|
| NAT gateway (needed for OpenAI, Anthropic, Google) | ~$33/month + data | same |
| Aurora Serverless v2 | storage only while paused; wakes on the first query (~15 s) | ≥ 0.5 ACU always on, ~$45/month + storage |
| Secrets Manager | 2 × $0.40/month | same |
| Lambda, API Gateway, S3, Cognito | pennies at POC traffic | usage-based |

`npx cdk destroy -c stage=dev` removes a dev stage completely. Prod keeps a database snapshot and retains the secret, user pool and bucket.

## Not included yet

- EventBridge schedules and SQS fan-out (ARCHITECTURE §9)
- Presigned photo upload (the bucket exists; the route and the Lambda's permission don't)
- Resend email
- Alarms and dashboards
- A custom API domain
