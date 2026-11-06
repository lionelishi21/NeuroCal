#!/usr/bin/env bash
# Uploads the food photos (backend/food-images/<id>.webp, from `npm run foods:images -w @neurocal/backend`)
# to the website, where the app loads them from <WebSiteUrl>/foods/<id>.webp and keeps each one.
#   AWS_PROFILE=... infra/scripts/upload-food-images.sh [stage]      (default stage: dev)
# Photos already there are skipped. The app keeps a photo once it has it, so a replaced photo only
# reaches phones that haven't downloaded the old one: give a remade photo time, or bump its id.
set -euo pipefail

STAGE="${1:-dev}"
STACK="NeuroCal-${STAGE}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/backend/food-images"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

if ! compgen -G "$SRC/*.webp" >/dev/null; then
  echo "No photos in $SRC: run npm run foods:images -w @neurocal/backend first." >&2
  exit 1
fi
BUCKET="$(output WebSiteBucketName)"
DISTRIBUTION="$(output WebSiteDistributionId)"
if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "$STACK has no website yet: deploy the stack with it first (npm run deploy -- -c stage=$STAGE -c website=true)." >&2
  exit 1
fi

echo "Uploading $(ls "$SRC"/*.webp | wc -l | tr -d ' ') food photos to s3://${BUCKET}/foods…"
aws s3 sync "$SRC" "s3://$BUCKET/foods" --exclude "*" --include "*.webp" \
  --content-type image/webp --cache-control "public,max-age=604800"
# A photo asked for before it was uploaded may be cached as missing.
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/foods/*" --query "Invalidation.Id" --output text >/dev/null

echo "Live at $(output WebSiteUrl)/foods/<id>.webp"
