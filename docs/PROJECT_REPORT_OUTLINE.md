# Project Report Outline

**Title:** Smart Campus Complaint Management System with Docker, CI/CD and Cloud Deployment

Suggested length: 40–60 pages. Section numbers below are a suggestion; follow your
university's template where it differs. Text in *italics* is guidance for you to
replace with your own writing.

---

**Front matter:** title page, certificate, declaration, acknowledgement, table of
contents, list of figures, list of tables, abbreviations (API, CI/CD, CORS,
CSRF, GSI, HSTS, HTTPS, JWT, PaaS, RBAC, SDK, TLS, XSS).

## Abstract (≈250 words)
*Problem (campus complaints handled informally, lost, untracked) → solution (web
portal with role-based dashboards) → technologies (React, Node.js/Express,
Docker, GitHub Actions, Render) → automation (every push tested and
containerised; only passing commits deployed through a secret deploy hook and
verified by health checks) → results (state only what you measured: number of tests passing,
deployment time from your Actions runs, etc.).*

## 1. Introduction
1.1 Background: complaint handling in colleges; digital campus services.
1.2 Motivation: transparency, accountability, faster resolution; why cloud and DevOps.
1.3 Scope: one campus, two roles (student, administrator), web interface.
1.4 Organisation of the report.

## 2. Problem Statement
*Complaints are submitted on paper, by email or verbally; students cannot see
progress; administrators have no consolidated view or statistics; manual
deployment of software is slow and error-prone.*

## 3. Objectives
1. Let students register, submit categorised complaints and track their status.
2. Let administrators view, filter and update complaints and see statistics.
3. Enforce authentication and role-based authorization on the server.
4. Store data through a database adapter layer (JSON-file store in deployment; DynamoDB adapter designed and tested).
5. Package the application with Docker.
6. Automate testing and deployment with GitHub Actions and Render (CI/CD).
7. Provide health checks and centralised logs (Render Logs).

## 4. Existing System and Limitations
Paper registers / email / generic forms (e.g. Google Forms): no status tracking,
no access control per student, no analytics, data scattered, no audit trail.
Manual software deployment: no tests, "works on my machine", downtime, credentials shared.

## 5. Proposed System
Overview, user roles, workflow diagram (submit → Pending → In Progress → Resolved),
advantages over the existing system. Include the architecture diagram from
`docs/ARCHITECTURE.md`.

## 6. Requirements
6.1 **Functional requirements** — table with ID, requirement, implemented in (file), verified by (test ID from `docs/TESTING.md`). Example:

| ID | Requirement | Implementation | Verification |
| --- | --- | --- | --- |
| FR1 | Student registration and login | `routes/auth.js`, `Register.jsx`, `Login.jsx` | T05–T10, M03 |
| FR2 | Submit complaint with category and optional location | `routes/complaints.js`, `NewComplaint.jsx` | T16–T19, M05 |
| FR3 | View/filter own complaints with status and dates | `StudentDashboard.jsx` | T22–T24, M06 |
| FR4 | Admin views and filters all complaints | `routes/admin.js`, `AdminDashboard.jsx` | T31–T32 |
| FR5 | Admin updates status | `PATCH /admin/complaints/:id/status` | T33–T35, M09–M10 |
| FR6 | Dashboard statistics | `GET /admin/stats`, `StatCards`, `BarChart` | T36 |

6.2 **Non-functional requirements:** security (hashing, RBAC, OWASP-style
controls), performance (indexed queries, no scans), availability and
observability (health checks, logs), maintainability (tests, adapters),
portability (Docker), usability (responsive UI), cost (single instance, on-demand).

6.3 Hardware/software requirements (development machine, browsers, Docker, Render free plan).

## 7. Technology Stack
One short subsection per technology, explaining *what it is* and *why it was
chosen*. You can adapt the explanations in `docs/PRESENTATION_AND_VIVA.md` §3.

## 8. System Architecture
8.1 Architecture diagram. 8.2 Component description (frontend, API, adapters).
8.3 Request flow (sequence diagram for "submit complaint" and "update status").
8.4 Design decisions table (from `docs/ARCHITECTURE.md` §3).
8.5 Use-case diagram (Student, Administrator). 8.6 Activity diagram of the complaint lifecycle.

## 9. Database Design
Tables, attributes, keys, GSIs, access patterns, trade-offs (from `docs/DATABASE.md`).
Include a screenshot of the tables and indexes in the DynamoDB console.

## 10. API Documentation
Endpoint table and examples (from `docs/API.md`), status codes, error format.

## 11. Implementation
Key code excerpts with explanation (keep each short): authorization middleware,
ownership check in `GET /complaints/:id`, DynamoDB query on the GSI, structured
logger, Dockerfile, workflow deploy step. UI screenshots of every page.

## 12. CI/CD Workflow
12.1 CI vs CD definitions. 12.2 Pipeline diagram (jobs and conditions).
12.3 Step-by-step explanation of `.github/workflows/ci-cd.yml`.
12.4 Deployment trigger diagram (tests pass → deploy hook secret → Render build → health check for the new commit).
12.5 Evidence: screenshots of a green run, a failing-test run, the deployment summary.
12.6 Measured timings from *your* runs (duration of each job).

## 13. Cloud Deployment on Render
Why Render (Docker support, HTTPS, free plan without a credit card; the AWS
account could not be verified); the `render.yaml` Blueprint (infrastructure as
code); environment variables and secrets handling; health checks and zero-downtime
switch-over; logs and deploy history; **free-plan limitations** (spin-down, no
persistent disk, data reset) and how they were handled (admin bootstrap from
environment variables); paths to production (persistent disk, managed database).
Use `docs/RENDER_DEPLOYMENT.md`.

## 14. Testing
Methodology (unit/integration, mocked DynamoDB SDK, smoke, post-deployment, manual);
test case table T01–T52 and M01–M12 with **actual** results from your runs; coverage
summary; screenshots of the terminal output and the coverage report.

## 15. Results
Screenshots (list below) with captions and short discussion. Report only what you observed.

## 16. Security Considerations
Threat/control table from `docs/SECURITY.md`; known limitations (HTTP-only demo URL).

## 17. Limitations
See `docs/PRESENTATION_AND_VIVA.md` §7.

## 18. Future Enhancements
See `docs/PRESENTATION_AND_VIVA.md` §7.

## 19. Conclusion
Summarise objectives achieved (with evidence), lessons learned about cloud and DevOps.

## 20. References
Use your university's citation style. Official documentation used:
1. React documentation — https://react.dev/
2. Vite guide — https://vite.dev/guide/
3. Express 5 documentation — https://expressjs.com/
4. Node.js documentation — https://nodejs.org/docs/latest/api/
5. Jest documentation — https://jestjs.io/docs/getting-started
6. Supertest — https://github.com/ladjs/supertest
7. Docker documentation (Dockerfile reference, multi-stage builds) — https://docs.docker.com/
8. GitHub Actions documentation — https://docs.github.com/en/actions
9. GitHub Actions: using secrets — https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
10. GitHub Actions: deployment environments — https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment
11. Render: Docker — https://render.com/docs/docker
12. Render: Blueprint YAML reference — https://render.com/docs/blueprint-spec
13. Render: Deploy hooks — https://render.com/docs/deploy-hooks
14. Render: Free instances — https://render.com/docs/free
15. Render: Health checks — https://render.com/docs/health-checks
16. Amazon DynamoDB Developer Guide (adapter design) — https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/
17. OWASP Top 10 — https://owasp.org/www-project-top-ten/
18. OWASP Cheat Sheets (Authentication, Session Management, CSRF) — https://cheatsheetseries.owasp.org/

---

## Evidence and screenshots to capture

Capture these **after actually running** each step. Never edit screenshots or
invent numbers; if something failed, include it and explain how you fixed it, which
examiners usually value.

**Application (local and live)**
1. Landing page (desktop) and the same page at phone width.
2. Registration with validation errors; successful registration.
3. Complaint form with errors; success message after submission.
4. Student dashboard with several complaints, badges, dates, and an active filter.
5. Student trying `/admin` and landing back on their dashboard.
6. Admin dashboard: summary cards and both charts.
7. Admin "Manage" panel updating a status with a note; success message.
8. Student view showing the updated status and admin note.
9. Browser address bar showing the **Render URL** (`https://…onrender.com`, padlock visible) with the app loaded.
10. `/api/health` and `/api/health/ready` responses in the browser (live URL).

**Testing**
11. Terminal output of `npm test` (summary lines visible).
12. Coverage table / `coverage/lcov-report/index.html`.
13. A deliberately failing test in a pull request (red ❌) and the fixed run (green ✓).
14. Browser dev tools → Application → Cookies showing `scc_token` as HttpOnly and SameSite=Strict.
15. curl/Postman showing `403` for a student on `/api/admin/stats` and `401` without login.

**Docker**
16. `docker build` finishing, `docker images` listing the image.
17. `docker compose up` with app and DynamoDB Local running; `docker compose ps`.
18. Data still present after `docker compose down` and `up`.

**CI/CD**
19. GitHub Actions run graph with all three jobs green.
20. Expanded "Run backend tests" step; expanded "Smoke test the container" step.
21. Deploy job: "Trigger deployment on Render" and "Wait for the new version to go live" steps (the hook URL appears masked as `***`).
22. Deploy job summary with URL and commit.
23. Secrets and variables page showing `RENDER_DEPLOY_HOOK_URL` (value hidden) and `RENDER_APP_URL`.
24. `production` environment with branch restriction.
25. A code change → merged PR → automatic deployment → changed page live.

**Render**
26. Blueprint / service overview: Docker runtime, Free plan, region, status **Live**.
27. Environment tab (blur `ADMIN_EMAIL`; secrets are hidden by Render).
28. Settings: Health Check Path `/api/health`, Auto-Deploy **Off**, Deploy Hook section (do not reveal the URL).
29. Events: deploy history with commit SHAs matching your GitHub commits.
30. Logs: JSON log lines, e.g. `server started` with the version and `complaint status updated`.
31. Logs showing `bootstrap administrator created` after a restart (evidence of the free-plan data reset and how it is handled).
32. Metrics tab, if available on your plan.
33. After cleanup: the deleted service.
