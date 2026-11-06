#!/usr/bin/env bash
# Builds web-poc as a static site for a deployed stage and uploads it (infra/README.md, "Website").
#   AWS_PROFILE=... infra/scripts/deploy-web.sh [stage]      (default stage: dev)
# The API address and Cognito ids come from the stack's outputs, so deploy the stack first.
set -euo pipefail

STAGE="${1:-dev}"
STACK="NeuroCal-${STAGE}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

BUCKET="$(output WebSiteBucketName)"
DISTRIBUTION="$(output WebSiteDistributionId)"
if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "$STACK has no website yet: deploy the stack with it first (npm run deploy -- -c stage=$STAGE -c website=true)." >&2
  exit 1
fi

echo "Building the website for ${STACK}…"
cd "$ROOT/web-poc"
rm -rf out
STATIC_EXPORT=1 \
  NEXT_PUBLIC_API_URL="$(output ApiUrl)" \
  NEXT_PUBLIC_COGNITO_USER_POOL_ID="$(output UserPoolId)" \
  NEXT_PUBLIC_COGNITO_CLIENT_ID="$(output UserPoolClientId)" \
  npx next build

# The mock API's worker is only for local development.
rm -f out/mockServiceWorker.js

echo "Uploading to s3://${BUCKET}…"
# Hashed build files never change, so they're cached for a year; pages are checked on every visit.
aws s3 sync out/_next "s3://$BUCKET/_next" --delete --cache-control "public,max-age=31536000,immutable"
# foods/ holds the food photos (upload-food-images.sh), which aren't part of the build.
aws s3 sync out "s3://$BUCKET" --delete --exclude "_next/*" --exclude "foods/*" --cache-control "public,max-age=0,must-revalidate"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" --query "Invalidation.Id" --output text >/dev/null

echo "Live at $(output WebSiteUrl)"
