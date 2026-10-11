# Deploying to Render with Docker (Step by Step)

This guide puts the app online at a public HTTPS address and connects it to the
GitHub Actions pipeline, so that every push to `main` is **tested first and
deployed only if the tests pass**.

```
git push ─▶ GitHub Actions
             │ CI: tests ─▶ frontend build ─▶ docker build ─▶ container smoke test
             │ CD (main only, after CI passes):
             ▼   call Render deploy hook ─▶ Render builds the Dockerfile ─▶ starts container
                 ─▶ pipeline waits until https://<app>.onrender.com/api/health reports the new commit
```

> **Honesty note.** The Render configuration (`render.yaml`) and the deploy job
> were checked with linters and the Docker image was tested locally exactly as
> Render runs it (`PORT=10000`, `RENDER_GIT_COMMIT`, HTTPS cookie settings). They
> have **not** been run on a real Render account. Record what actually happens for
> your report, and if a screen differs, follow Render's current documentation.

## 0. What the free plan gives you, and its limitations

Render's free web services need no credit card for the basic free path.
Limitations you must know about and mention in your report:

| Free-plan limitation | Effect on this project | Workaround |
| --- | --- | --- |
| **No persistent disk**; the filesystem is reset on every restart, redeploy or spin-down | Complaints and student accounts are **lost** whenever the service restarts, redeploys or spins down. The admin account is recreated automatically from `ADMIN_EMAIL`/`ADMIN_PASSWORD` | For the demo, create the data shortly before presenting. For permanent data: paid instance + persistent disk (see §8) |
| **Spins down after 15 minutes without traffic** | The first request afterwards takes about a minute (cold start), and the data is reset (see above) | Open the site a minute or two before the demo |
| **750 free instance hours per month** per workspace | One service running all month fits; extra free services share the hours | Delete unused free services |
| **No shell access** | `npm run create-admin` can't be run on the server | Admin is created at start-up from secret environment variables |
| Render may restart free services at any time | Same as the first row | — |

The local development setup is unchanged and keeps its data: the JSON file in
`backend/data/` or the DynamoDB Local volume in Docker Compose.

## 1. Prerequisites

1. The code on GitHub with a `main` branch (already done). Set `main` as the
   **default branch**: GitHub → Settings → General → Default branch.
2. A free Render account: https://render.com → **Get Started** → sign up with
   **GitHub** (this also lets Render read your repository).

## 2. Create the service from the Blueprint (`render.yaml`)

`render.yaml` in the repository root describes the service:

| Setting | Value | Why |
| --- | --- | --- |
| `runtime: docker` | Builds the existing `Dockerfile` | Same image as local and CI |
| `plan: free` | Free instance | No cost |
| `region: singapore` | Closest Render region to India | Lower latency; change if needed |
| `healthCheckPath: /api/health` | Render only sends traffic to a new version once this returns 200 | Zero-downtime switch-over |
| `autoDeployTrigger: off` | Render does **not** deploy on every commit by itself | GitHub Actions deploys only after tests pass |
| `envVars` | See §3 | Configuration without secrets in Git |

Steps:
1. Render Dashboard → **New → Blueprint**.
2. Connect your GitHub account if asked, and select the repository
   `smart-campus-complaint-portal-`.
3. Render reads `render.yaml` and shows the service `smart-campus-complaint-portal`.
4. It asks for the values marked `sync: false`:
   * `ADMIN_EMAIL`: e.g. `admin@yourcollege.edu`
   * `ADMIN_PASSWORD`: a long, unique password (**at least 12 characters**, with a letter and a number)
5. Click **Apply / Deploy Blueprint**. The first build takes about 3–10 minutes.
   Watch it in the service's **Events** and **Logs** tabs.
6. When it shows **Live**, copy the URL at the top of the service page, e.g.
   `https://smart-campus-complaint-portal.onrender.com`. If the name is taken,
   Render adds a suffix, so always copy the real URL.

Check it:
```bash
curl https://<your-app>.onrender.com/api/health
curl https://<your-app>.onrender.com/api/health/ready
```
Then open the URL in a browser, register a student, and log in as the admin
with the email and password you entered.

> **Without the Blueprint (manual alternative):** New → Web Service → select the
> repo → Language **Docker** → Branch `main` → Instance type **Free** → add the
> environment variables from §3 by hand (generate `JWT_SECRET` with
> `openssl rand -hex 32`) → Advanced: Health Check Path `/api/health`,
> Auto-Deploy **Off** → Create Web Service.

## 3. Environment variables and secrets

| Variable | Value on Render | Secret? | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | No | Production mode: requires a strong `JWT_SECRET` |
| `DB_DRIVER` | `local` | No | Built-in JSON-file database (the free plan has no other durable storage) |
| `LOCAL_DB_FILE` | `/app/data/local-db.json` | No | Where the data file is written inside the container |
| `COOKIE_SECURE` | `true` | No | Render serves HTTPS, so the login cookie is marked `Secure` |
| `LOG_LEVEL` | `info` | No | Log detail |
| `JWT_SECRET` | generated by Render (`generateValue: true`) | **Yes** | Signs login tokens. Never stored in Git |
| `ADMIN_NAME` | `Campus Admin` | No | Display name of the start-up admin |
| `ADMIN_EMAIL` | you enter it | Treat as private | Start-up admin login |
| `ADMIN_PASSWORD` | you enter it | **Yes** | Start-up admin password (hashed with bcrypt before storage) |
| `PORT` | set automatically by Render (10000) | No | The app listens on `$PORT` |
| `RENDER_GIT_COMMIT` | set automatically by Render | No | Reported by `/api/health` so the pipeline can confirm the new version |

To change values later: service → **Environment** → edit → **Save, rebuild and
deploy**. Values entered there are stored by Render, not in your repository.

**GitHub secrets and variables** (§4) are separate: GitHub only needs the deploy
hook URL (a secret) and the public app URL (a normal variable).

## 4. Connect GitHub Actions (deploy only after tests pass)

### 4.1 Copy the deploy hook URL

Render → your service → **Settings** → **Deploy Hook** → copy the URL
(it looks like `https://api.render.com/deploy/srv-...?key=...`).
**Treat it like a password**: anyone with it can trigger deployments. If it
leaks, regenerate it on the same page.

### 4.2 Add it to GitHub

GitHub repository → **Settings → Secrets and variables → Actions**:

| Tab | Name | Value |
| --- | --- | --- |
| **Secrets** → New repository secret | `RENDER_DEPLOY_HOOK_URL` | the deploy hook URL |
| **Variables** → New repository variable | `RENDER_APP_URL` | `https://<your-app>.onrender.com` |

### 4.3 Create the `production` environment

**Settings → Environments → New environment** → name `production` →
"Deployment branches and tags": **Selected branches** → add `main`.
Optional: add yourself as a **required reviewer** to approve each deployment
(handy for controlling timing during a demo).

### 4.4 How the pipeline deploys

`.github/workflows/ci-cd.yml`:

1. **CI: tests and frontend build** — `npm ci`, all backend tests, frontend build.
2. **CI: Docker build and smoke test** — builds the image, runs it, checks the
   health endpoints and the homepage, registers a user and creates a complaint.
3. **CD: deploy to Render** — runs only on `main` (a push or the **Run workflow**
   button), only when jobs 1 and 2 succeeded, and only when `RENDER_APP_URL` is set. It:
   * sends a POST request to the deploy hook (Render then builds the `Dockerfile` from `main`);
   * polls `https://<app>/api/health` every 20 seconds (up to 20 minutes) until it
     reports the commit SHA that was just tested;
   * checks `/api/health/ready` and that the homepage is served;
   * writes the URL and commit to the job summary.

If a test fails, jobs 2 and 3 never start, so a broken commit cannot be deployed.
If Render's build or start fails, Render keeps the previous version running and
job 3 fails after the timeout, with a message pointing to the Render logs.

### 4.5 First automatic deployment

Push any commit to `main`, or **Actions → CI/CD → Run workflow** on `main`.
Watch all three jobs turn green, then open the URL from the job summary.

## 5. Automatic deployment after a code change

```bash
git checkout -b feature/landing-text
# edit frontend/src/pages/Landing.jsx (e.g. the hero sentence)
git commit -am "Update landing page text"
git push -u origin feature/landing-text
```

Open a pull request: only CI runs (no deployment). Merge it: CI runs on `main`,
then CD deploys. Refresh the site and check `/api/health` shows the new commit.

## 6. Building and running the Docker image yourself

The same `Dockerfile` that Render uses:

```bash
docker build -t smart-campus:local .

# Run it the way Render does (port 10000, HTTPS-style settings off locally):
docker run --rm -p 10000:10000 \
  -e PORT=10000 -e NODE_ENV=production \
  -e DB_DRIVER=local -e LOCAL_DB_FILE=/app/data/local-db.json \
  -e COOKIE_SECURE=false \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.edu -e ADMIN_PASSWORD='choose-a-long-password1' \
  smart-campus:local
# open http://localhost:10000
```

Locally, `COOKIE_SECURE` must be `false` because `http://localhost` is not HTTPS.
Add `-v smart-campus-data:/app/data` to keep the data between runs.

## 7. Logs and monitoring

* **Logs:** service → **Logs**. The app writes one JSON line per event
  (`server started`, `request completed`, `complaint status updated`, errors), so
  you can search for `"level":"error"` or a `requestId`.
* **Health:** Render calls `/api/health` during deploys and while running; failures
  appear in **Events**. `/api/health/ready` also checks the data store.
* **Metrics:** service → **Metrics** (CPU, memory, requests) where available on your plan.
* **Deploy history:** service → **Events** lists each deploy with its commit.
  You can **roll back** to a previous deploy from there.

## 8. Keeping data permanently (optional, paid)

The free plan cannot keep data across restarts. Options if you need that:

* **Paid instance + persistent disk:** upgrade the service to a paid instance
  type, add a **Disk** with mount path `/app/data`, and keep
  `LOCAL_DB_FILE=/app/data/local-db.json`. The app already writes there, so no
  code change is needed. Check Render's pricing first, and confirm after the first
  restart that the data is still there.
* **External managed database:** the code already has a DynamoDB adapter
  (`DB_DRIVER=dynamodb`), which needs an AWS account. Supporting another database
  (e.g. PostgreSQL or MongoDB) would mean adding a new adapter with the same
  functions as `backend/src/db/localStore.js`; the rest of the app would not change.

## 9. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Blueprint creation fails | Read the error under the Blueprint; check `render.yaml` was not edited incorrectly (YAML indentation) |
| Build fails at `npm ci` | A `package-lock.json` is out of sync: run `npm install` locally in that folder, commit the lock file |
| Logs show `invalid configuration … JWT_SECRET` | `JWT_SECRET` missing or shorter than 32 characters. Set it in Environment |
| Logs show `could not create bootstrap administrator` | `ADMIN_PASSWORD` is shorter than 12 characters or lacks a letter/number, or the email is invalid |
| Admin login fails after some time | The free instance restarted and the data was reset. The admin is recreated automatically on start, so check `ADMIN_EMAIL`/`ADMIN_PASSWORD` match what you type |
| Logged out immediately after login | Opening the site over `http://` with `COOKIE_SECURE=true`. Always use the `https://` URL |
| Site takes ~1 minute to load | Free instance was spun down; this is normal |
| GitHub: deploy job skipped | `RENDER_APP_URL` is missing, was added as a *secret* instead of a *variable*, or was added inside the `production` environment instead of as a **repository** variable (Settings → Secrets and variables → Actions → **Variables** tab → *Repository variables*); or the run was not on `main` |
| GitHub: "RENDER_DEPLOY_HOOK_URL is not set" | Add the secret (§4.2). Secret names are case-sensitive |
| GitHub: "Render rejected the deploy hook request" | Wrong or regenerated hook URL; copy it again |
| GitHub: "did not report <sha> within 20 minutes" | Build or start failed on Render (see Render → Events/Logs), or a newer commit was deployed first |
| Deploys happen without GitHub Actions | Auto-Deploy is on. Set it to **Off** in service Settings (the Blueprint sets `autoDeployTrigger: off`) |

## 10. Cleanup after evaluation

* Render → service → **Settings → Delete Web Service** (and delete the Blueprint
  if you created one).
* GitHub → delete the `RENDER_APP_URL` variable (the pipeline then stops trying to
  deploy) and the `RENDER_DEPLOY_HOOK_URL` secret.

The free plan has no charges; if you upgraded to a paid instance or added a
disk, deleting the service stops the billing.

## Official documentation used

* Render free instances and limitations: https://render.com/docs/free
* Blueprint YAML reference (`render.yaml`): https://render.com/docs/blueprint-spec
* Deploy hooks: https://render.com/docs/deploy-hooks
* Deploys and auto-deploy settings: https://render.com/docs/deploys
* Health checks: https://render.com/docs/health-checks
* Default environment variables (`PORT`, `RENDER_GIT_COMMIT`): https://render.com/docs/environment-variables
* Docker on Render: https://render.com/docs/docker
* GitHub Actions encrypted secrets: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
* GitHub deployment environments: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment
