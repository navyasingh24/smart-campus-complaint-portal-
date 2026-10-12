#!/usr/bin/env bash
# Triggers a Render deploy through the deploy hook and waits until the live
# site reports the expected commit, then checks readiness and the homepage.
# Same behaviour as the GitHub Actions "CD: deploy to Render" job.
#
# Required environment: RENDER_DEPLOY_HOOK_URL (secret), RENDER_APP_URL,
#                       EXPECTED_VERSION (full Git commit SHA)
set -euo pipefail

: "${RENDER_DEPLOY_HOOK_URL:?RENDER_DEPLOY_HOOK_URL credential is missing}"
: "${RENDER_APP_URL:?RENDER_APP_URL is not set}"
: "${EXPECTED_VERSION:?EXPECTED_VERSION is not set}"

# Strip accidental spaces/newlines copied along with the URLs.
HOOK="$(printf '%s' "$RENDER_DEPLOY_HOOK_URL" | tr -d '[:space:]')"
URL="$(printf '%s' "$RENDER_APP_URL" | tr -d '[:space:]')"
URL="${URL%/}"

curl -fsS -X POST "$HOOK" -o /dev/null \
  || { echo "ERROR: Render rejected the deploy hook request. Check the render-deploy-hook-url credential."; exit 1; }
echo "Render deployment requested for commit ${EXPECTED_VERSION}"
echo "Render builds the Docker image and starts it; this usually takes 3-10 minutes."

for i in $(seq 1 60); do
  VERSION="$(curl -fsS --max-time 60 "${URL}/api/health" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch{}})' \
    || true)"
  if [ "$VERSION" = "$EXPECTED_VERSION" ]; then
    echo "New version is live: ${VERSION}"
    curl -fsS --max-time 30 "${URL}/api/health/ready" >/dev/null || { echo "ERROR: readiness check failed"; exit 1; }
    curl -fsS --max-time 30 "${URL}/" | grep -q '<div id="root">' || { echo "ERROR: website not served"; exit 1; }
    echo "Deployment verified: ${URL}"
    exit 0
  fi
  echo "  attempt ${i}: live version is '${VERSION:-unreachable}', waiting for ${EXPECTED_VERSION}"
  sleep 20
done

echo "ERROR: ${URL}/api/health did not report ${EXPECTED_VERSION} within 20 minutes. Check Render > Events/Logs."
exit 1
