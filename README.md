# Smart Campus Complaint Management System with AWS Cloud Automation and CI/CD

A full-stack web application where college students report campus problems
(Wi-Fi, classrooms, hostel, electricity, sanitation, …) and administrators track
and resolve them. Every push to `main` is tested, packaged as a Docker image and
deployed to AWS Elastic Beanstalk by GitHub Actions, then verified through a
health-check endpoint.

```
Developer ──git push──▶ GitHub ──▶ GitHub Actions
                                    │ CI: npm test ─▶ frontend build ─▶ docker build ─▶ container smoke test
                                    │ CD (main only): OIDC login ─▶ push image to ECR ─▶ deploy to Elastic Beanstalk
                                    ▼                                                   ─▶ GET /api/health (version check)
                     AWS: Elastic Beanstalk (EC2 + Docker) ──IAM role──▶ DynamoDB
                                    └── logs ──▶ CloudWatch Logs
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
| Database | Amazon DynamoDB (production), local JSON-file adapter or DynamoDB Local (development) |
| Auth | bcrypt password hashing, JWT in an httpOnly, SameSite=Strict cookie, role-based access control |
| Testing | Jest, Supertest, aws-sdk-client-mock |
| Packaging | Docker (multi-stage image), Docker Compose |
| CI/CD | GitHub Actions, GitHub OIDC → AWS IAM role |
| Cloud | AWS Elastic Beanstalk (Docker on Amazon Linux 2023), Amazon ECR, DynamoDB, IAM, CloudWatch Logs |
| Infrastructure as code | AWS CloudFormation (`infrastructure/cloudformation.yml`) |

## Quick start (local, no AWS account needed)

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

## Repository structure

```
.
├── .github/workflows/ci-cd.yml    CI (tests, build, Docker smoke test) and CD (deploy to AWS)
├── backend/
│   ├── src/
│   │   ├── server.js              Entry point: config, database adapter, start listening
│   │   ├── app.js                 Express app: security middleware, routes, static frontend
│   │   ├── config.js              Environment-variable configuration
│   │   ├── constants.js           Roles, categories, statuses
│   │   ├── errors.js              Safe, client-facing error types
│   │   ├── logger.js              JSON logs to stdout (→ CloudWatch)
│   │   ├── validation.js          Server-side input validation
│   │   ├── middleware/            auth (JWT + roles), request logging, error handling
│   │   ├── routes/                health, auth, complaints (student), admin
│   │   └── db/                    localStore (dev/tests), dynamoStore (AWS), table definitions
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
├── infrastructure/
│   ├── cloudformation.yml         DynamoDB, ECR, IAM roles, Elastic Beanstalk, GitHub OIDC role
│   ├── deploy-stack.sh            Creates/updates the stack
│   └── destroy-stack.sh           Deletes everything after evaluation
├── docs/                          Guides, report outline, presentation and viva preparation
├── Dockerfile                     Multi-stage production image
├── docker-compose.yml             App + DynamoDB Local for local testing
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
| [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) | Beginner AWS + GitHub OIDC deployment guide, costs, monitoring, cleanup |
| [docs/PROJECT_REPORT_OUTLINE.md](docs/PROJECT_REPORT_OUTLINE.md) | Report outline and evidence to capture |
| [docs/PRESENTATION_AND_VIVA.md](docs/PRESENTATION_AND_VIVA.md) | 5-minute script, demo plan, technology explanations, viva Q&A |

## Project status

What has been verified while building this repository, and what you must verify yourself:

| Item | Status |
| --- | --- |
| Backend automated tests (67 tests, ~93% line coverage) | Passed locally (Node 22) |
| Frontend production build | Passed locally |
| Docker image build and container smoke test | Passed locally |
| Docker Compose with DynamoDB Local (real DynamoDB code path, GSIs), data persisting after `docker compose down`/`up` | Passed locally |
| Browser walkthrough (register, submit, filter, admin update, mobile layout) | Passed locally with headless Chromium |
| CloudFormation template | Passes `cfn-lint`; **not yet deployed to a real AWS account** |
| GitHub Actions workflow | Passes `actionlint`; CI jobs will run on your first push; the deploy job runs **only after** you complete [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) |
| Live AWS deployment | **Not performed.** Capture your own evidence (see the report outline) |
