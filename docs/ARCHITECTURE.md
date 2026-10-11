# Architecture and Design Decisions

## 1. System overview

```
                         ┌──────────────────────────── AWS account (one region) ───────────────────────────┐
 Browser (student/admin) │                                                                                  │
   │  HTTP :80           │  Elastic Beanstalk environment (single instance, Docker on Amazon Linux 2023)    │
   └────────────────────▶│  ┌──────────── EC2 instance (t3.micro) ────────────┐                             │
                         │  │ nginx :80 ──▶ Docker container :8080            │   IAM instance role         │
                         │  │               Node.js / Express                 │──(temporary credentials)──▶ DynamoDB
                         │  │               ├─ /api/*   REST API              │                             │  scc users table
                         │  │               └─ /*       built React app       │                             │  complaints table + 2 GSIs
                         │  └──────────────────────┬──────────────────────────┘                             │
                         │                         │ stdout / stderr, health                                │
                         │                         ▼                                                        │
                         │                  CloudWatch Logs                                                 │
                         │  Amazon ECR (Docker images) ◀── push ── GitHub Actions (OIDC role)               │
                         └──────────────────────────────────────────────────────────────────────────────────┘
```

There is **one** backend application (no microservices). Express serves both the
REST API under `/api` and the compiled React app, so the browser talks to a
single origin. That removes the need for CORS and lets the login cookie use
`SameSite=Strict`.

## 2. Request flow (example: a student submits a complaint)

1. React (`NewComplaint.jsx`) validates the form and calls `POST /api/complaints` with a JSON body.
2. The browser automatically attaches the `scc_token` httpOnly cookie.
3. Express middleware runs in order: security headers (helmet) → CORS (deny by
   default) → JSON body parser (20 KB limit) → cookie parser → request logger →
   "JSON only" check for state-changing requests.
4. `requireAuth` verifies the JWT signature and expiry; `requireRole('STUDENT')` checks the role.
5. `validateComplaint` checks every field on the server.
6. The route builds the complaint (UUID, owner = user id **from the token**, status `PENDING`, timestamps).
7. The database adapter writes it (DynamoDB `PutItem` in AWS, JSON file locally).
8. A structured log line is written; the response is `201 Created`.

## 3. Key design decisions (beginner-friendly explanations)

| Decision | Why |
| --- | --- |
| **React + Vite** | Vite gives a fast development server and builds optimised static files that Express can serve. |
| **Express serves the frontend** | One container, one URL, no CORS. Simpler to deploy and explain than a separate S3/CloudFront frontend. |
| **DynamoDB** | Serverless: no database server to patch, on-demand billing (you pay per request, near zero for a demo), and access is controlled with IAM roles instead of a password. |
| **Database adapter pattern** (`db/localStore.js`, `db/dynamoStore.js`) | Both adapters expose the same functions. Local development and tests need no AWS account and cannot touch production data. |
| **JWT in an httpOnly cookie** | Stateless sessions (no session table), and JavaScript cannot read the token, which limits the damage of an XSS bug. |
| **Docker** | The same image runs on a laptop, in GitHub Actions and on AWS: "works on my machine" problems disappear. |
| **Elastic Beanstalk (Docker platform)** | AWS handles the EC2 instance, nginx, Docker, health monitoring and log streaming. Much less to configure than raw EC2 or ECS for a student project. |
| **Single-instance environment** | No load balancer, so the cost is low. The trade-off: no HTTPS on the default URL and no high availability (see Limitations). |
| **Amazon ECR + Dockerrun.aws.json** | The image that passed the tests is exactly the image that runs in production. Beanstalk only pulls it and does not build anything on the small instance. |
| **GitHub OIDC** | GitHub Actions gets short-lived AWS credentials per run. No long-lived access keys are stored anywhere. |
| **CloudFormation** | All AWS resources are described in one file and created/deleted with one command, which makes the setup repeatable and cleanup reliable. Terraform would also work but needs an extra tool and state storage; CloudFormation is built into AWS. |
| **Plain CSS and a hand-made bar chart** | Fewer dependencies to learn and maintain; the dashboard only needs simple comparisons. |

## 4. CI vs CD

| | Continuous Integration (CI) | Continuous Deployment (CD) |
| --- | --- | --- |
| **Goal** | Prove that every change still works | Automatically release changes that passed CI |
| **When** | Every push and every pull request | Pushes to `main` only, after CI passed and once AWS is configured |
| **Jobs** | `test` (backend tests, frontend build), `docker` (image build + smoke test) | `deploy` (ECR push, Beanstalk deploy, live health check) |
| **AWS access** | None | Temporary credentials via OIDC, only in the `production` GitHub environment |
| **If it fails** | The pull request shows a red ❌; nothing is deployed | The previous version keeps running; the job prints Beanstalk events and the log location |

## 5. What is automated vs. manual

| Task | Without automation | In this project |
| --- | --- | --- |
| Running tests | Developer remembers to run them | Every push/PR, merge blocked visually when red |
| Building the app | Manual `npm run build` | CI builds frontend and Docker image |
| Packaging | Manually zip/copy files to a server | Docker image built and pushed to ECR by CI |
| Deploying | Upload in the console, click deploy | `git push` to `main` → automatic deploy |
| Verifying | Open the site and hope | Pipeline checks `/api/health` reports the new commit SHA and `/api/health/ready` reaches DynamoDB |
| Creating AWS resources | ~30 console screens | One `deploy-stack.sh` command (CloudFormation) |
| Cleanup | Hunt for leftover resources | One `destroy-stack.sh` command |
| Logs | SSH into the server | Streamed to CloudWatch Logs automatically |
| **Still manual (once)** | | AWS account and budget alert, running `deploy-stack.sh`, adding 5 GitHub variables, creating the first admin |

## 6. Phase-by-phase implementation summary

| Phase | Files | How to verify |
| --- | --- | --- |
| 1. Architecture and requirements | `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` | Read through; matches the requirements table in the report outline |
| 2. Frontend | `frontend/**` | `cd frontend && npm run build` succeeds; `npm run dev` shows the landing page |
| 3. Backend and local database adapter | `backend/src/app.js`, `server.js`, `config.js`, `logger.js`, `db/*` | `npm run dev`, then `curl localhost:8080/api/health` |
| 4. Auth, authorization, complaints | `backend/src/middleware/auth.js`, `routes/*`, `validation.js`, `scripts/create-admin.js` | Register/login in the UI; student cannot open `/admin`; API returns 403 for students on admin routes |
| 5. Automated tests | `backend/tests/*` | `cd backend && npm test` → all suites pass |
| 6. Containerization | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `backend/scripts/create-tables.js` | `docker compose up --build`, open http://localhost:8080 |
| 7. AWS deployment | `infrastructure/cloudformation.yml`, `deploy-stack.sh`, `destroy-stack.sh` | Follow `docs/AWS_DEPLOYMENT.md`; stack status `CREATE_COMPLETE` |
| 8. GitHub Actions + OIDC | `.github/workflows/ci-cd.yml` | Push to `main`; all three jobs green |
| 9. Health checks and monitoring | `routes/health.js`, `middleware/requestLogger.js`, CloudWatch options in the template | `/api/health`, `/api/health/ready`; log group in CloudWatch |
| 10. Documentation and presentation | `docs/*` | Use for report, demo and viva |

**Outstanding configuration you must do yourself:** AWS account, budget alert,
running the CloudFormation stack, GitHub repository variables and the
`production` environment, and creating the first administrator in DynamoDB.
All steps are in [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md).
