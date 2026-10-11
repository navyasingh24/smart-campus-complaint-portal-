# Presentation, Live Demonstration and Viva Preparation

## 1. Five-minute presentation script

*(≈130 words per minute. Suggested slides in brackets.)*

**0:00 – Problem (slide: photos/icons of Wi-Fi, hostel, electricity issues)**
"Good morning. On our campus, problems like broken Wi-Fi, leaking taps or faulty
lights are reported on paper, by email or by word of mouth. Students never know
whether anyone is working on their complaint, and administrators have no single
place to see what is pending. My project solves this with a Smart Campus
Complaint Management System, and it also automates how the software is tested
and deployed to the cloud."

**0:40 – Solution (slide: two roles and the status lifecycle)**
"Students register, submit a complaint with a category and location, and track
it from Pending to In Progress to Resolved. Administrators see every complaint,
filter them, update the status with a note to the student, and see summary
statistics and charts."

**1:20 – Architecture (slide: architecture diagram)**
"The frontend is built with React. The backend is a single Node.js and Express
application that also serves the website. Data is stored in Amazon DynamoDB.
The app is packaged as a Docker container and runs on AWS Elastic Beanstalk.
Logs go to Amazon CloudWatch. I deliberately kept one backend instead of
microservices so the system stays simple to understand and maintain."

**2:00 – Security (slide: security table)**
"Passwords are hashed with bcrypt. After login, the server issues a signed token
stored in an httpOnly cookie, which JavaScript cannot read. Every protected API
checks the token and the role on the server, and a student can never read
another student's complaint, because the owner always comes from the verified
token. There is no default admin password; the first administrator is created
with a command-line script. On AWS, the app has no access keys at all: it uses an
IAM role that can only read and write its own two tables."

**2:50 – CI/CD (slide: pipeline diagram)**
"Every push triggers GitHub Actions. Continuous integration runs 67 automated
tests, builds the frontend, builds the Docker image and smoke-tests the running
container. If anything fails, the pipeline stops. For the main branch,
continuous deployment then logs into AWS using OpenID Connect — temporary
credentials, no stored secrets — pushes the exact tested image to Amazon ECR,
deploys it to Elastic Beanstalk and checks that the live health endpoint reports
the new version. All AWS resources are created by one CloudFormation template."

**3:40 – Demo (switch to browser; see §2, short version)**

**4:30 – Results and conclusion (slide: results, limitations, future work)**
"*State your real results: number of tests passing, average pipeline duration
from your runs, the live URL working.* Limitations are that the demo URL uses
HTTP and runs on a single instance. Next steps are HTTPS with a domain, email
notifications and image uploads. Thank you — I'm happy to take questions."

## 2. Live demonstration plan

**Before the session (30 minutes earlier)**
* [ ] Environment Health is **Ok**; open `http://<url>/api/health` — note the version.
* [ ] Log in once as admin and as a demo student to confirm passwords.
* [ ] Prepare 3–4 complaints in different categories/statuses so charts look meaningful.
* [ ] Open tabs: live site (student, normal window), live site (admin, private window), GitHub Actions, AWS console (Beanstalk, DynamoDB, CloudWatch).
* [ ] Prepare a tiny code change on a branch (e.g. landing page subtitle text).
* [ ] **Backup:** `docker compose up` running locally, plus screenshots and a screen recording of a full pipeline run, in case the network fails.

**Demo sequence (≈8–10 minutes when the panel allows a longer demo)**
1. Landing page → register a new student live.
2. Submit a complaint with an empty form (show validation), then a valid one (show success message, Pending badge).
3. Filter by category. Try `/admin` as the student → redirected.
4. Private window: log in as admin → cards and charts → filter Pending → Manage → set **In Progress** with a note.
5. Back in the student window, refresh → new status and note.
6. DynamoDB console → Explore items → show the complaint and its `status`.
7. CloudWatch Logs Insights → run the "status changes" query → show your update logged.
8. Commit and push the prepared change (or merge its pull request) → show the pipeline running → explain the jobs while it runs.
9. When the deploy job finishes (5–10 min, so start step 8 early or show a recent run) → refresh the site → change is live; `/api/health` shows the new commit SHA.
10. Optional: show a pull request with a failing test that blocked deployment.

## 3. The technologies, explained simply

| Technology | One-sentence explanation | Role in this project |
| --- | --- | --- |
| **React** | A JavaScript library for building user interfaces from reusable components. | All pages and components of the website. |
| **Vite** | A build tool and development server for modern frontends. | Fast local development; produces optimised static files. |
| **Node.js** | Runs JavaScript on a server. | Runtime for the backend. |
| **Express** | A minimal web framework for Node.js. | REST API, middleware, serving the built frontend. |
| **REST API** | A way for programs to talk over HTTP using URLs and verbs (GET, POST, PATCH). | Frontend ↔ backend communication with JSON. |
| **bcrypt** | A slow, salted password-hashing algorithm. | Passwords are stored as hashes only. |
| **JWT** | A signed token containing user id and role; the server can verify it without a database lookup. | Session after login, stored in an httpOnly cookie. |
| **Jest / Supertest** | Jest runs tests and checks expectations; Supertest sends HTTP requests to the app in tests. | 67 automated API and database tests. |
| **Docker** | Packages an application and everything it needs into an image that runs the same everywhere as a container. | One image used in CI, locally and on AWS. |
| **Git / GitHub** | Version control; GitHub hosts the repository. | Source code, pull requests, triggers the pipeline. |
| **GitHub Actions** | GitHub's automation service that runs workflows on events like a push. | The CI/CD pipeline. |
| **CI** | Automatically building and testing every change. | `test` and `docker` jobs. |
| **CD** | Automatically deploying changes that passed CI. | `deploy` job for `main`. |
| **AWS** | Amazon's cloud platform: rent computing, storage and databases on demand. | Hosts the application and data. |
| **IAM** | AWS Identity and Access Management: who can do what in the account. | Roles for the instance, Beanstalk and GitHub, with minimal permissions. |
| **OIDC** | OpenID Connect: a standard way for one system to prove identity to another with signed tokens. | GitHub proves "this is my repo's production job" to AWS and gets temporary credentials. |
| **STS** | AWS Security Token Service, issues temporary credentials. | Exchanges the GitHub OIDC token for 1-hour credentials. |
| **DynamoDB** | A fully managed NoSQL key-value database; you pay per request. | Users and complaints tables, queried through indexes. |
| **GSI** | Global secondary index: an alternative key to query a DynamoDB table by. | Query complaints by student or by status, newest first. |
| **Amazon ECR** | A private Docker image registry. | Stores each tested image, tagged with the commit SHA. |
| **Elastic Beanstalk** | A service that runs your application and manages servers, Docker, health monitoring and deployments for you. | Runs the container on an EC2 instance behind nginx. |
| **EC2** | Virtual servers in AWS. | The `t3.micro` instance Beanstalk manages. |
| **CloudWatch** | AWS monitoring: logs, metrics and alarms. | Application, nginx and deployment logs; health metrics. |
| **CloudFormation** | Infrastructure as code: describe AWS resources in a file, AWS creates them. | One template creates every resource; one command deletes them. |

## 4. Key concepts in more depth

**Docker.** An *image* is a read-only package (OS libraries, Node.js, our code);
a *container* is a running instance of it. Our `Dockerfile` has two stages: the
first builds the React app, the second contains only production dependencies,
the backend and the built frontend, and runs as a non-root user. Benefits:
identical environment everywhere, small and reproducible.

**Elastic Beanstalk.** We give Beanstalk a tiny `Dockerrun.aws.json` file naming
the image in ECR. Beanstalk launches an EC2 instance, installs Docker and nginx,
pulls and runs the image, forwards port 80 to the container's port 8080, checks
`/api/health`, and streams logs to CloudWatch. We chose a *single-instance*
environment (no load balancer) to keep costs low.

**IAM roles vs. access keys.** An access key is a permanent password for the
API: if leaked, anyone can use it until it is deleted. A role gives temporary
credentials that expire automatically. The EC2 instance gets its credentials
from the instance metadata service; GitHub gets them through OIDC.

**OIDC flow.** (1) The deploy job asks GitHub for a signed token. (2) The token
says which repository, branch/environment and workflow is running. (3) AWS STS
verifies the signature using the registered OIDC provider and checks the role's
trust policy (`repo:<owner>/<repo>:environment:production`). (4) STS returns
credentials valid for ≤ 1 hour. Another repository or a pull request cannot
assume the role.

**DynamoDB indexing.** Tables are queried by key. The `userId-createdAt-index`
answers "my complaints, newest first" directly, and the `status-createdAt-index`
answers "all Pending complaints". The admin's "all complaints" query asks the
three status partitions and merges results, so we never scan the whole table.

**CloudWatch.** The app writes one JSON line per event to stdout. Docker
captures it, Beanstalk streams it to CloudWatch Logs, and Logs Insights can
filter and aggregate fields like `statusCode` or `durationMs`.

## 5. Common viva questions and answers

1. **Why DynamoDB and not MySQL?** Serverless (no database server to patch or
   size), on-demand billing that is almost free for low traffic, and IAM-based
   access without a database password. The trade-off is that queries must be
   designed around keys and indexes; ad-hoc reporting is harder than with SQL.
2. **What is a GSI and why two?** An alternative key. One for "by student", one
   for "by status"; each serves a dashboard query without scanning.
3. **Why not a Scan for the admin list?** A Scan reads every item and costs grow
   with table size. Three small queries on the status index read only what is needed.
4. **How do you stop a student from seeing another student's complaint?** The user
   id comes from the signed token, not from the request. List queries use that
   id, and the single-complaint endpoint returns 404 unless you are the owner or an
   admin. Tests T23 and T26 prove it.
5. **Why 404 instead of 403 there?** So students cannot learn which complaint ids exist.
6. **Why store the token in a cookie and not localStorage?** An httpOnly cookie
   cannot be read by JavaScript, so an XSS bug cannot steal it.
7. **Then how do you prevent CSRF?** `SameSite=Strict` cookies are not sent from
   other sites, and state-changing requests must be JSON, which cross-site forms
   cannot send without a CORS preflight that the server refuses.
8. **How are passwords stored?** bcrypt hashes with a random salt; even the admin
   cannot see passwords.
9. **How is the first admin created?** With `npm run create-admin`, run by a
   person who has database access; the password is typed hidden. Registration
   can only create students.
10. **What is the difference between CI and CD?** CI automatically tests and
    builds every change; CD automatically deploys changes that passed CI.
    Here CI runs on all pushes/PRs; CD only on `main`.
11. **What happens if a test fails?** The `test` job exits non-zero, later jobs
    don't start, and nothing is deployed. The PR shows a red cross.
12. **How does GitHub log in to AWS without a password?** OIDC: GitHub's signed
    token is exchanged with AWS STS for temporary credentials, allowed only for
    this repository's `production` environment.
13. **Why build the image in GitHub and not on Beanstalk?** The deployed image is
    exactly the one that passed the smoke test, and the small instance doesn't need
    to run `npm install` or a frontend build.
14. **How do you know the deployment worked?** The pipeline waits for Beanstalk to
    report Ready with the new version label, then calls `/api/health` and checks
    it returns the new commit SHA, and `/api/health/ready` confirms DynamoDB access.
15. **What if the new version is broken?** The post-deployment check fails, so the
    job turns red and prints the recent Beanstalk events and where to find the
    logs. To recover, redeploy the previous application version (Beanstalk keeps
    the last 10) from the console, or push a fix/revert, which goes through the
    same tested pipeline.
16. **Difference between `/api/health` and `/api/health/ready`?** Liveness (the
    process responds) vs. readiness (it can also reach its database). Beanstalk polls
    the cheap one often; the pipeline checks both.
17. **Where are the logs and what is in them?** CloudWatch Logs; JSON lines with
    timestamp, level, request id, method, path, status code, duration and user
    id — never passwords or request bodies.
18. **Why Elastic Beanstalk instead of ECS, EKS or Lambda?** Least to learn and
    configure for one container; Beanstalk manages EC2, Docker, nginx, health and
    logs. ECS/EKS are better for many services; Lambda would require restructuring
    the Express app.
19. **Why a single instance? What are the risks?** Cost. The risks: downtime
    during deployments and if the instance fails, and no HTTPS on the default
    URL. A load-balanced environment fixes both but costs more.
20. **What does CloudFormation give you?** Repeatability (same setup every time),
    documentation of the infrastructure as code, and clean deletion.
21. **How do you handle secrets?** The JWT secret is generated randomly, passed as
    a NoEcho CloudFormation parameter into an Elastic Beanstalk environment
    property, and never committed. AWS credentials don't exist as secrets at all.
    Improvement: AWS Secrets Manager.
22. **What is least privilege, and where did you apply it?** Give each identity
    only the permissions it needs: the app role can only Get/Put/Update/Query its
    two tables; the deploy role can push only to one ECR repository.
23. **How does the app work locally without AWS?** A local database adapter with
    the same interface stores data in a JSON file; Docker Compose can also run
    DynamoDB Local.
24. **How do your tests avoid touching AWS?** In-memory database for API tests,
    and a mocked AWS SDK client for the DynamoDB adapter tests.
25. **What would you change for 10,000 users?** HTTPS with a load balancer and
    auto scaling, pagination, pre-computed statistics counters, a category index,
    Secrets Manager, alarms, and possibly CloudFront for static assets.

## 6. Automated vs. manual work

See the table in [ARCHITECTURE.md §5](ARCHITECTURE.md#5-what-is-automated-vs-manual).
In one sentence: *after a one-time setup (AWS account, one script, five GitHub
variables, first admin), every code change is tested, packaged, deployed and
verified by a single `git push`.*

## 7. Limitations and future improvements

**Limitations**
* Plain HTTP on the demo URL (no TLS) because there is no load balancer or domain.
* Single EC2 instance: brief downtime during deployments; no automatic failover.
* No email/SMS notifications; students must log in to see updates.
* No file or photo attachments.
* No password reset, email verification or account management.
* Lists are capped at 1,000 items per query and not paginated in the UI.
* Statistics are computed on request by reading all complaints (fine at campus scale).
* Tokens cannot be revoked before expiry; the rate limiter is in-memory.
* Frontend has no automated UI tests (verified manually and by API tests).

**Future enhancements**
* HTTPS: custom domain + ACM certificate on a load-balanced, auto-scaling environment (or CloudFront).
* Email notifications on status change (Amazon SES).
* Photo attachments stored in Amazon S3 with pre-signed upload URLs.
* Password reset and email verification; optional college SSO.
* Complaint comments/history timeline and priority levels; assignment to departments/staff.
* Pagination and search; a category index; pre-computed statistics (DynamoDB Streams + Lambda).
* Secrets in AWS Secrets Manager; CloudWatch alarms with SNS notifications.
* Frontend tests (Vitest + Testing Library) and end-to-end tests (Playwright) in CI.
* Staging environment with manual approval before production.
