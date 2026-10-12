# Smart Campus Complaint Management System with Docker, CI/CD and Cloud Deployment

A full-stack web application where college students report campus problems
(Wi-Fi, classrooms, hostel, electricity, sanitation, …) and administrators track
and resolve them. Every push to `main` is tested and packaged as a Docker image
by GitHub Actions. **Only if all tests pass** is it deployed to
[Render](https://render.com) and then checked through its health endpoint.

```
Developer ──git push──▶ GitHub ──▶ GitHub Actions
                                    │ CI: npm test ─▶ frontend build ─▶ docker build ─▶ container smoke test
                                    │ CD (main only, after CI passes): Render deploy hook
                                    ▼
                     Render (free web service): builds the Dockerfile ─▶ runs the container over HTTPS
                                    └── pipeline waits until /api/health reports the new commit
```

## Features

| Students | Administrators |
| --- | --- |
| Register and log in securely | Log in to a role-protected dashboard |
| Submit complaints (title, description, category, optional location) | View all complaints with student details and timestamps |
| View own complaints with status badges and dates | Filter by status and category |
| Filter by category and status | Update status (Pending → In Progress → Resolved) with a note to the student |
| See the latest status and any note from the administrator | Summary cards and bar charts by status and category |

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Vite, React Router, plain CSS |
| Backend | Node.js 24 (works on 22+), Express 5 |
| Database | Built-in JSON-file adapter (local and Render); Amazon DynamoDB adapter (optional, tested with DynamoDB Local) |
| Auth | bcrypt password hashing, JWT in an httpOnly, SameSite=Strict cookie, role-based access control |
| Testing | Jest, Supertest, aws-sdk-client-mock |
| Packaging | Docker (multi-stage image), Docker Compose |
| CI/CD | GitHub Actions (CI on every push/PR, CD to Render after tests pass); Jenkins pipeline (`Jenkinsfile`) as an alternative deployer |
| Infrastructure as code | `render.yaml` Blueprint (web service); Terraform with the `render-oss/render` provider (environment group + link) |
| Hosting | Render free web service, Docker runtime, HTTPS (`render.yaml` Blueprint) |

## Quick start (local development, no cloud account needed)

Requires Node.js 22 or newer. Full macOS instructions are in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

```bash
# Terminal 1: API on http://localhost:8080
cd backend
npm install
cp .env.example .env
sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env   # macOS sed syntax
npm run dev

# Terminal 2: website on http://localhost:5173
cd frontend
npm install
npm run dev

# Terminal 3: create the first administrator (typed password stays hidden)
cd backend
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@example.edu npm run create-admin

# Run the automated tests
cd backend && npm test
```

## Build and run with Docker

The `Dockerfile` builds the React app and packages it with the backend into
one image. Render uses the same file.

```bash
# 1. Build the image (from the repository root)
docker build -t smart-campus:local .

# 2. Run it (open http://localhost:8080)
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e DB_DRIVER=local -e LOCAL_DB_FILE=/app/data/local-db.json \
  -e COOKIE_SECURE=false \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.edu -e ADMIN_PASSWORD='choose-a-long-password1' \
  -v smart-campus-data:/app/data \
  smart-campus:local

# 3. Check it
curl http://localhost:8080/api/health

# Rebuild after code changes
docker build -t smart-campus:local .
```

* `-v smart-campus-data:/app/data` keeps the data between container restarts.
* `ADMIN_EMAIL` / `ADMIN_PASSWORD` are optional. When set, an administrator is
  created at start-up if it doesn't exist (password: at least 12 characters with
  a letter and a number). Without them, use `npm run create-admin`.
* `COOKIE_SECURE=false` is needed only because `http://localhost` is not HTTPS.
* To test with a DynamoDB-compatible database instead, use `docker compose up --build`
  (see [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)).

## Deploy to Render (free)

Full guide with screenshots-to-take, limitations and troubleshooting:
[docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md). In short:

1. **Create the service.** Sign up at https://render.com with GitHub, then
   **New → Blueprint**, choose this repository, and Render reads `render.yaml`.
   Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` when asked, then **Apply**.
2. **Environment variables.** These are set by `render.yaml`:

   | Variable | Value | Notes |
   | --- | --- | --- |
   | `NODE_ENV` | `production` | |
   | `DB_DRIVER` | `local` | JSON-file database |
   | `LOCAL_DB_FILE` | `/app/data/local-db.json` | |
   | `COOKIE_SECURE` | `true` | Render serves HTTPS |
   | `JWT_SECRET` | generated by Render | Secret; never in Git |
   | `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your values | Password is secret |
   | `PORT`, `RENDER_GIT_COMMIT` | set automatically by Render | |
3. **Live URL.** When the service is **Live**, copy its URL from the top of
   the service page, e.g. `https://smart-campus-complaint-portal.onrender.com`.
   Check `https://<your-app>.onrender.com/api/health`.
4. **Connect the pipeline.** GitHub → Settings → Secrets and variables → Actions:
   * Secret `RENDER_DEPLOY_HOOK_URL` = Render → service → Settings → **Deploy Hook**
   * Variable `RENDER_APP_URL` = your live URL

   Then create the environment **Settings → Environments → `production`**,
   restricted to the `main` branch.
5. **Deploy.** Push to `main`. GitHub Actions runs the tests and the Docker smoke
   test, calls the deploy hook only if they pass, and waits until the live
   `/api/health` reports the new commit.

**Free-plan limitations:** the service sleeps after 15 minutes without traffic,
so the first request then takes about a minute. It has **no persistent disk**,
so complaints and student accounts are **reset** on every restart, redeploy or
sleep. The admin account is recreated automatically from the environment
variables. There's no shell access, and 750 free instance hours per month.
For permanent data you need a paid instance with a persistent disk mounted at
`/app/data` (no code change). See the guide for details.

## Jenkins + Terraform pipeline (optional second pipeline)

Alongside GitHub Actions, the project also has a **Jenkins pipeline**
(`Jenkinsfile`) and **Terraform** configuration (`terraform/`) for Render. They
reuse the same `Dockerfile`, tests and Render deploy hook. Nothing about the
working GitHub Actions → Render deployment changes until you choose to switch
it over (step 9).

```
git push ─▶ GitHub ──webhook──▶ Jenkins (Docker on your Mac)
                                 1. Checkout
                                 2. Tests: backend (Jest) ∥ frontend build
                                 3. Docker build + smoke test (same image as Render)
                                 4. Terraform fmt -check · init · validate
                                 5. Terraform plan          (when TERRAFORM_ENABLED=true)
                                 6. Terraform apply         (main only, needs your click to approve)
                                 7. Deploy to Render        (main only, when DEPLOY_MODE=jenkins)
                                    └─ deploy hook → wait for /api/health = this commit
```

Any failing stage stops the pipeline, so deployment only happens after the tests,
the Docker smoke test and the Terraform checks have passed.

### What Terraform manages on Render, and what it does not

| Render resource | Managed by | Why |
| --- | --- | --- |
| Environment group `smart-campus-app-settings` (`JWT_EXPIRES_IN`, `AUTH_RATE_LIMIT_MAX`) | **Terraform** (`render_env_group`) | Supported by the official provider; no secrets, so nothing sensitive in state |
| Link between that group and the web service | **Terraform** (`render_env_group_link`) | Supported; links by service ID without editing the service itself |
| The web service (Docker runtime, region, plan, health check, auto-deploy off) | **`render.yaml` Blueprint** (unchanged) | The provider (`render-oss/render` v1.9.x) cannot reliably update an existing **free-plan** web service: it always sends `maintenance_mode`, which Render rejects for free instances ([issue #80](https://github.com/render-oss/terraform-provider-render/issues/80), [PR #105](https://github.com/render-oss/terraform-provider-render/pull/105)). Two tools owning one service would also conflict. |
| Secrets: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `render.yaml` + Render dashboard | Keeps secrets out of Terraform state |
| Deploy hook | Render dashboard (Jenkins credential / GitHub secret) | Not exposed by the provider |

The two Terraform-managed settings default to the **same values the app already
uses** (`8h`, `20`), so the first `terraform apply` changes nothing for users.
Variables set directly on a service override a linked group, so the group only
contains keys that `render.yaml` does not define. Changes to the group take
effect on the next deploy of the service.

### Costs and free-tier limits

| Item | Cost |
| --- | --- |
| Jenkins in Docker on your Mac | Free (uses about 2–4 GB RAM while running) |
| Terraform CLI, `render-oss/render` provider | Free |
| Render environment groups and API key | No extra charge (check Render's pricing page; the web service stays on the free plan) |
| Cloudflare quick tunnel for the GitHub webhook | Free, no account; the URL changes every time it starts |
| Polling fallback | Free; Jenkins checks GitHub every 5 minutes if the webhook is not reachable |

Limits: Jenkins only runs while your Mac and Docker are running. Terraform state
is a **local file** in the Jenkins volume (see "State" below). All Render free-plan
limits still apply (sleep after 15 minutes, data reset on restart).

### 1. Start Jenkins with Docker

Requires Docker Desktop. The image bundles Node.js 24, the Docker CLI and
Terraform 1.16.5 (`jenkins/Dockerfile`). A `docker:dind` sidecar runs the image
builds, as in the official Jenkins Docker guide.

```bash
cd smart-campus-complaint-portal-/jenkins
docker compose up -d --build              # first build takes a few minutes
# If port 8080 is busy (for example the app's own docker compose):
#   JENKINS_PORT=8081 docker compose up -d --build
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open http://localhost:8080, paste the password, choose **Select plugins to install
→ None → Install** (the required plugins are already in the image:
Pipeline, Git, GitHub, Credentials Binding, Pipeline Stage View, Timestamper),
then create your admin user.

### 2. Add credentials (Manage Jenkins → Credentials → System → Global → Add Credentials)

Kind **Secret text** for each. The IDs must match exactly:

| ID | Value | Where to find it |
| --- | --- | --- |
| `render-deploy-hook-url` | Deploy hook URL | Render → service → Settings → Deploy Hook |
| `render-api-key` | Render API key | Render → Account Settings → API Keys → Create API Key |
| `render-owner-id` | Workspace ID (`usr-…` or `tea-…`) | Render → Workspace Settings (shown on the page / in the URL) |

Jenkins stores them encrypted in its volume; they are masked as `****` in logs and
never committed. If your repository is private, also add a **Username with
password** credential (GitHub username + personal access token) and select it in
step 4.

### 3. Set global variables (Manage Jenkins → System → Global properties → Environment variables)

| Name | Value |
| --- | --- |
| `RENDER_APP_URL` | `https://smart-campus-complaint-portal.onrender.com` |
| `RENDER_SERVICE_ID` | `srv-…` (Render → service → Settings, or the dashboard URL) |
| `TERRAFORM_ENABLED` | `true` (only after step 2's Render credentials exist) |
| `DEPLOY_MODE` | `github` for now (see step 9) |

### 4. Create the pipeline job

**New Item** → name `smart-campus` → **Pipeline** → OK, then:
* **Build Triggers:** tick **GitHub hook trigger for GITScm polling**.
* **Pipeline:** Definition **Pipeline script from SCM** → SCM **Git** →
  Repository URL `https://github.com/navyasingh24/smart-campus-complaint-portal-.git`
  → Branch `*/main` → Script Path `Jenkinsfile` → **Save**.
* Click **Build Now** once. The first run registers the triggers declared in the
  Jenkinsfile (`githubPush()` and the `pollSCM` fallback).

### 5. Connect the GitHub webhook

GitHub can't reach `localhost`, so expose Jenkins with a free Cloudflare quick tunnel:

```bash
docker run --rm --network jenkins_jenkins cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://jenkins:8080
# prints https://<random-words>.trycloudflare.com
```

GitHub → repository → **Settings → Webhooks → Add webhook**:
* Payload URL: `https://<random-words>.trycloudflare.com/github-webhook/` (keep the trailing slash)
* Content type: `application/json`, events: **Just the push event** → **Add webhook**.

GitHub's "Recent Deliveries" should show a green tick. The tunnel URL changes every
time you restart it, so update the webhook then. Anyone with the URL can reach your
Jenkins login page while the tunnel runs, so use a strong admin password and stop
the tunnel (Ctrl+C) when you're not demonstrating. Without a tunnel, the `pollSCM`
fallback still starts a build within about 5 minutes of a push.

### 6. Initialise and plan Terraform

With `TERRAFORM_ENABLED=true`, every Jenkins build runs:
`terraform fmt -check` → `terraform init -backend=false` → `terraform validate` →
`terraform init` (local state) → `terraform plan -detailed-exitcode`. The plan is
saved as the build artifact `tfplan.txt`. The first plan should show
**2 to add** (the environment group and its link).

To run Terraform from your Mac instead (only for trying it out, see "State" below):

```bash
brew install hashicorp/tap/terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars      # set render_service_id (git-ignored)
read -rs RENDER_API_KEY && export RENDER_API_KEY   # paste the key; it is not echoed
export RENDER_OWNER_ID=usr-xxxxxxxx
terraform fmt -check && terraform init && terraform validate && terraform plan
```

### 7. Apply Terraform (manual approval)

On `main`, when the plan has changes, the **Terraform apply** stage pauses and
shows an **Apply / Abort** prompt (Stage View → click the paused stage). It shows a
warning when the plan deletes or replaces resources. Read `tfplan.txt`, then click
**Apply**. Aborting, or waiting 30 minutes, leaves the infrastructure unchanged and
the rest of the pipeline continues. Jenkins never runs `terraform destroy`.

Verify in Render: **Environment Groups → smart-campus-app-settings** shows the two
variables, and the service's **Environment** page lists the linked group.

### 8. State management

* Backend: Terraform's `local` backend. Jenkins stores the state at
  `/var/jenkins_home/terraform-state/smart-campus/terraform.tfstate` inside the
  persistent `jenkins-data` volume, **outside** the build workspace.
* State files, plans and `terraform.tfvars` are git-ignored; the API key is never
  written to state (it is only read from the environment).
* `disableConcurrentBuilds()` plus Terraform's local lock file prevent two runs
  changing the state at once.
* **Use one state.** After Jenkins has applied, don't also `apply` from your Mac with
  a separate local state; Terraform would try to create a second environment group.
  Back up the Jenkins state with:
  `docker compose cp jenkins:/var/jenkins_home/terraform-state ./terraform-state-backup`
  (keep the backup private and out of Git).
* For shared or team use, move to a remote backend with locking, such as HCP
  Terraform's free tier. That isn't configured here, to keep the project free of
  extra accounts.

### 9. Choose who deploys (avoids duplicate deployments)

Exactly one system should call the Render deploy hook:

| Mode | GitHub variable `DEPLOY_MODE` | Jenkins global variable `DEPLOY_MODE` | Result |
| --- | --- | --- | --- |
| **GitHub Actions deploys** (default, current) | unset or `github` | `github` | GitHub Actions runs CI + CD; Jenkins runs CI + Terraform, skips Deploy |
| **Jenkins deploys** | `jenkins` | `jenkins` | GitHub Actions runs CI only (deploy job skipped with a notice); Jenkins deploys |

To switch to Jenkins: set the GitHub repository variable `DEPLOY_MODE=jenkins`
(Settings → Secrets and variables → Actions → Variables) **and** the Jenkins global
variable `DEPLOY_MODE=jenkins`. Change both back to switch again. Both pipelines
still run their tests on every push; only the deployment is exclusive.

### 10. Verify the whole chain

1. Push a small change to `main` (for example a sentence in `frontend/src/pages/Landing.jsx`).
2. GitHub → Settings → Webhooks → Recent Deliveries: a `200` response.
3. Jenkins → `smart-campus` → the new build: all stages green in **Stage View**.
4. With `DEPLOY_MODE=jenkins`: the Deploy stage log ends with `Deployment verified`,
   and `https://<your-app>.onrender.com/api/health` shows the new commit.
5. GitHub Actions for the same commit: CI green, deploy job **skipped** with the
   notice "DEPLOY_MODE=jenkins".

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `docker: Cannot connect to the Docker daemon` in a build | The `docker` (dind) container isn't running: `docker compose ps`, then `docker compose up -d` |
| Jenkins page doesn't open | Port in use: start with `JENKINS_PORT=8081`; check `docker compose logs jenkins` |
| `No such DSL method 'githubPush'` / `timestamps` | A plugin is missing: Manage Jenkins → Plugins → Installed; rebuild the image (`docker compose build --no-cache`) |
| Webhook delivery 4xx/5xx or timeout | Tunnel stopped or URL changed; restart it and update the Payload URL (keep `/github-webhook/`) |
| Webhook OK but no build | The job needs one manual **Build Now** first, and the trigger box from step 4 ticked |
| `CredentialNotFound: render-api-key` | Credential ID typo; IDs are case-sensitive |
| `terraform fmt -check` fails | Run `terraform fmt -recursive` in `terraform/` and commit |
| `terraform init`: provider download fails | No internet from Jenkins, or registry outage; retry |
| Plan error `render_service_id must look like srv-…` | Set the Jenkins global variable `RENDER_SERVICE_ID` |
| Plan shows a new env group although one exists | The state was lost or a different state is in use; import it: `terraform import render_env_group.app_settings evg-…` and `terraform import render_env_group_link.app_settings evg-…` |
| Apply error mentioning `maintenance_mode` | Something is trying to manage the web service itself; this configuration deliberately doesn't (see the table above) |
| Deploy stage skipped | `DEPLOY_MODE` isn't `jenkins`, or the build isn't on `main` |
| Deploy: `did not report <sha> within 20 minutes` | Render build failed (Render → Events/Logs), or a newer commit was deployed first |
| Both GitHub Actions and Jenkins deployed | The two `DEPLOY_MODE` values don't match; set both (step 9) |

### Cleanup

```bash
# 1. Remove the Terraform-managed resources (env group + link) from Render.
#    Your web service is NOT affected: it isn't managed by Terraform.
docker compose exec jenkins bash -c '
  read -rs -p "Render API key: " RENDER_API_KEY; echo; export RENDER_API_KEY
  read -r  -p "Owner ID (usr-/tea-): " RENDER_OWNER_ID; export RENDER_OWNER_ID
  cd /var/jenkins_home/workspace/smart-campus/terraform
  terraform init -input=false -reconfigure -backend-config=path=/var/jenkins_home/terraform-state/smart-campus/terraform.tfstate
  terraform destroy -var render_service_id="$RENDER_SERVICE_ID"'
# 2. Stop Jenkins and delete its data (credentials, builds, Terraform state).
cd jenkins && docker compose down -v
```

Then delete the GitHub webhook, revoke the Render API key (Render → Account
Settings → API Keys), and remove the GitHub variable `DEPLOY_MODE` so GitHub Actions
deploys again.

## Repository structure

```
.
├── .github/workflows/ci-cd.yml    CI (tests, build, Docker smoke test, Terraform validate) and CD (deploy to Render)
├── Jenkinsfile                    Jenkins pipeline: tests, Docker, Terraform plan/apply, deploy
├── jenkins/                       Jenkins image (Dockerfile, plugins), docker-compose, smoke-test and deploy scripts
├── terraform/                     Terraform for Render (env group + link), variables, outputs
├── backend/
│   ├── src/
│   │   ├── server.js              Entry point: config, database adapter, start listening
│   │   ├── app.js                 Express app: security middleware, routes, static frontend
│   │   ├── config.js              Environment-variable configuration
│   │   ├── constants.js           Roles, categories, statuses
│   │   ├── errors.js              Safe, client-facing error types
│   │   ├── bootstrapAdmin.js      Optional admin creation from environment variables
│   │   ├── logger.js              JSON logs to stdout (→ Render logs)
│   │   ├── validation.js          Server-side input validation
│   │   ├── middleware/            auth (JWT + roles), request logging, error handling
│   │   ├── routes/                health, auth, complaints (student), admin
│   │   └── db/                    localStore (JSON file), dynamoStore (DynamoDB, optional), table definitions
│   ├── scripts/                   create-admin, create-tables (DynamoDB Local)
│   ├── tests/                     Jest + Supertest test suites
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                 Landing, Login, Register, StudentDashboard, NewComplaint, AdminDashboard
│   │   ├── components/            Navbar, ProtectedRoute, StatusBadge, Filters, StatCards, BarChart, …
│   │   ├── api.js                 fetch wrapper for the API
│   │   ├── AuthContext.jsx        Logged-in user state
│   │   └── styles.css             Design system and responsive layout
│   └── vite.config.js             Dev server with /api proxy
├── docs/                          Guides, report outline, presentation and viva preparation
├── Dockerfile                     Multi-stage production image
├── docker-compose.yml             App + DynamoDB Local for local testing
├── render.yaml                    Render Blueprint (Docker web service, env vars, health check)
├── .dockerignore / .gitignore
└── .env.example                   JWT_SECRET for docker compose
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, design decisions, CI vs CD, phase-by-phase summary |
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | macOS setup, running, testing APIs, Docker, troubleshooting |
| [docs/DATABASE.md](docs/DATABASE.md) | DynamoDB data model, indexes, query trade-offs |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Security controls and first-admin creation |
| [docs/TESTING.md](docs/TESTING.md) | Automated and manual test cases, how to read results |
| [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) | Render + GitHub Actions deployment guide, environment variables, limitations, troubleshooting |
| [docs/PROJECT_REPORT_OUTLINE.md](docs/PROJECT_REPORT_OUTLINE.md) | Report outline and evidence to capture |
| [docs/PRESENTATION_AND_VIVA.md](docs/PRESENTATION_AND_VIVA.md) | 5-minute script, demo plan, technology explanations, viva Q&A |

## Project status

What has been verified while building this repository, and what you must verify yourself:

| Item | Status |
| --- | --- |
| Backend automated tests (74 tests) | Passed locally (Node 22) |
| Frontend production build | Passed locally |
| Docker image build and container smoke test | Passed locally |
| Container run with Render's settings (`PORT=10000`, `RENDER_GIT_COMMIT`, secure cookies, admin from env vars) | Passed locally |
| Docker Compose with DynamoDB Local, data persisting after `docker compose down`/`up` | Passed locally |
| Browser walkthrough (register, submit, filter, admin update, mobile layout) | Passed locally with headless Chromium |
| GitHub Actions CI + CD to Render | Passed on GitHub, including automatic deployment |
| Jenkins image (Node 24, Docker CLI + buildx, Terraform 1.16.5) | Built and checked locally (plugin download step not run in the build sandbox) |
| `jenkins/smoke-test.sh`, `jenkins/deploy-render.sh` | Run locally from the Jenkins image (smoke test pass/fail, deploy against a local stand-in for Render) |
| `Jenkinsfile` | **Not yet run on a Jenkins server**; run it with the steps above |
| Terraform | `terraform fmt` passes locally; `init`/`validate` run in GitHub Actions; **`plan`/`apply` not yet run against your Render account** |
| `render.yaml` and live Render deployment | Live at https://smart-campus-complaint-portal.onrender.com, deployed automatically by GitHub Actions |
