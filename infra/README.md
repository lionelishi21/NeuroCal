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
- `adminEmails`: comma-separated sign-in emails allowed to manage products at `/admin`. Set it in `cdk.json` under `context` so every deploy keeps it.
- `warmDatabase`: `true` (set in `cdk.json`) keeps a non-prod database awake at 0.5 ACU; `false` lets dev pause when idle. Prod never pauses.
- `dbProxy`: `true` or `false` to put RDS Proxy in front of Aurora. Unset, it is on for prod only.
- `alarmEmail`: an address to email alarms to (API 5xx, throttling, Lambda errors). No alarms without it.

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

   **Knowledge pipeline.** To check Dave Asprey's YouTube channel for new videos each month, add `YOUTUBE_API_KEY` (a YouTube Data API v3 key from Google Cloud) to the same secret. `KNOWLEDGE_CHANNELS` (comma-separated channel ids) changes which channels are watched. Without the key, videos are added by hand on the admin Knowledge page.

   **Device scout.** On the 2nd of each month the `DeviceScout` Lambda searches for new air fryers, water filters, ice cream makers and blenders (the devices the shopping review suggests) with `TAVILY_API_KEY`, and Claude (`ANTHROPIC_API_KEY`) picks specific models from the results. They wait on the admin Devices page; only approved ones become products. Without either key the run is skipped.

   **Air quality.** The environment pillar reads air quality and town names from Open-Meteo (https://open-meteo.com). Its free API is for non-commercial use only: once NeuroCal earns money, take a paid plan and add its key as `OPEN_METEO_API_KEY`, which moves the calls to Open-Meteo's customer endpoints.

   **Crash reports.** Add `SENTRY_DSN` (from a Sentry Node project: Settings → Client Keys) and every unexpected API error and failed scheduled run is sent to Sentry, tagged with the stage and route. Only the error type, a scrubbed message and the stack go; no request bodies, users or health values. Without it nothing is sent; errors are still in CloudWatch.

   **Subscriptions.** Purchases go through RevenueCat (https://www.revenuecat.com). In RevenueCat, create an entitlement called `pro` with the yearly and monthly products, and a webhook to `<ApiUrl>/webhooks/revenuecat` with an Authorization header value of your choosing. Put that exact value in the secret as `REVENUECAT_WEBHOOK_AUTH` (for example `Bearer` plus a long random string), and RevenueCat's secret API key as `REVENUECAT_SECRET_KEY`. The paywall stays off until you add `PAYWALL` = `on`; do that once the store products are live and the apps that show the paywall are out, or the AI features will refuse everyone.

      **Waitlist email.** The landing page's "Tell me when it's ready" form saves addresses whether or not email is set up. To send the confirmation email, add `RESEND_API_KEY` (from https://resend.com) to the same secret, after verifying the sending domain with Resend. `EMAIL_FROM` defaults to `NeuroCal <hello@neurocal.ai>` and `WEB_URL` (where unsubscribe links point) to `https://neurocal.ai`; set either in the secret to change it. The website's address must also be in `webOrigins` when you deploy, or browsers will block the form.

   Lambdas read the secret once per cold start. After changing keys, force new containers, for example by redeploying or updating any environment value.
5. **Embed the catalog.** Repeat this after every change to `backend/src/infrastructure/catalog/catalog.ts`:
   ```sh
   aws lambda invoke --function-name <CatalogSyncFunctionName> /dev/stdout
   ```

## Production

Prod is its own stack (`NeuroCal-prod`): its own database, users, secret and bucket, so testing on dev never touches real people. Ideally put it in a separate AWS account too (AWS Organizations), so a mistake in dev can't reach it; the steps are the same with that account's profile.

1. **Raise the Lambda limit first.** New accounts can run only 10 Lambdas at once, which one person opening the app can use up. Ask for 1,000 (free, usually a day):
   ```sh
   aws service-quotas request-service-quota-increase --service-code lambda --quota-code L-B99A9384 --desired-value 1000
   ```
2. **Deploy** with the website's origin and an alarm address:
   ```sh
   npm run deploy -- -c stage=prod -c webOrigins=https://neurocal.ai -c alarmEmail=you@example.com
   ```
   Prod differs from dev: the database never pauses and scales to 8 ACU, deletion protection is on, a deleted stack keeps a snapshot, backups are kept 14 days (the delete-account page promises this), logs 3 months, and the secret, user pool and bucket are retained. RDS Proxy sits between the Lambdas and Aurora, so many Lambdas share a few database connections; migrations still connect directly. Confirm the subscription email AWS sends to the alarm address, or alarms go nowhere.
3. **Secrets.** Add the API keys to the prod `AppSecretArn` as in "First deploy" step 4, with production keys (a separate OpenAI project and Anthropic workspace make spend easy to watch). Add `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_KEY` and `RESEND_API_KEY`, and `PAYWALL` = `on` once the store products are live.
4. **Embed the catalog** with the prod `CatalogSyncFunctionName` (step 5 above).
5. **Point the apps at it.** Copy `mobile-app/env/prod.example.json` to `env/prod.json` with the prod outputs and RevenueCat keys, and build the store releases with `--dart-define-from-file=env/prod.json`. RevenueCat's webhook goes to the prod `ApiUrl`.

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
| RDS Proxy | off (`-c dbProxy=true` to try it) | billed as 8 ACU minimum, ~$85/month |
| CloudWatch alarms (with `alarmEmail`) | $0.10 per alarm per month | same |
| Aurora Serverless v2 | ≥ 0.5 ACU always on, ~$45/month + storage (`warmDatabase` in `cdk.json`); with `-c warmDatabase=false`, storage only while paused and ~15 s to wake | ≥ 0.5 ACU always on, ~$45/month + storage |
| Secrets Manager | 2 × $0.40/month | same |
| Lambda, API Gateway, S3, Cognito | pennies at POC traffic | usage-based |

`npx cdk destroy -c stage=dev` removes a dev stage completely. Prod keeps a database snapshot and retains the secret, user pool and bucket.

## Not included yet

- EventBridge schedules and SQS fan-out (ARCHITECTURE §9)
- Presigned photo upload (the bucket exists; the route and the Lambda's permission don't)
- Resend email
- Dashboards (alarms are in, with `alarmEmail`)
- A custom API domain
