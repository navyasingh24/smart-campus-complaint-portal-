#!/usr/bin/env bash
# Starts the freshly built image and checks it the same way the GitHub Actions
# smoke test does: health version, readiness, homepage, register a student,
# create a complaint and list it. Requests run inside the container (Node 24
# has fetch), so this works with Docker-in-Docker without port mapping.
#
# Usage: smoke-test.sh <image> <expected-version> [container-name]
set -euo pipefail

IMAGE="$1"
EXPECTED_VERSION="$2"
NAME="${3:-smoke-test}"
SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

cleanup_on_error() {
  echo "Smoke test failed. Container logs:"
  docker logs "$NAME" || true
}
trap cleanup_on_error ERR

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e NODE_ENV=production -e DB_DRIVER=local -e COOKIE_SECURE=false \
  -e LOCAL_DB_FILE=/app/data/smoke.json \
  -e JWT_SECRET="$SECRET" \
  "$IMAGE" >/dev/null

docker exec -e EXPECTED_VERSION="$EXPECTED_VERSION" "$NAME" node -e '
const base = "http://127.0.0.1:8080";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.error("SMOKE TEST FAILED: " + msg); process.exit(1); };
(async () => {
  let health;
  for (let i = 0; i < 30 && !health; i++) {
    try { health = await (await fetch(base + "/api/health")).json(); } catch { await sleep(1000); }
  }
  if (!health) fail("no response from /api/health");
  console.log("health:", JSON.stringify(health));
  if (health.version !== process.env.EXPECTED_VERSION) fail("unexpected version " + health.version);

  if ((await fetch(base + "/api/health/ready")).status !== 200) fail("readiness check");
  if (!(await (await fetch(base + "/")).text()).includes("<div id=\"root\">")) fail("frontend not served");

  const json = { "Content-Type": "application/json" };
  const reg = await fetch(base + "/api/auth/register", { method: "POST", headers: json,
    body: JSON.stringify({ name: "Smoke Test", email: "smoke@example.com", password: "SmokeTest123" }) });
  if (reg.status !== 201) fail("register returned " + reg.status);
  const cookie = reg.headers.get("set-cookie").split(";")[0];

  const created = await fetch(base + "/api/complaints", { method: "POST", headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ title: "Smoke test complaint", description: "Created by the Jenkins smoke test.", category: "OTHER" }) });
  if (created.status !== 201) fail("create complaint returned " + created.status);

  const list = await (await fetch(base + "/api/complaints", { headers: { Cookie: cookie } })).json();
  if (list.complaints.length !== 1) fail("expected 1 complaint, got " + list.complaints.length);
  console.log("Smoke test passed");
})().catch((e) => fail(e.message));
'
