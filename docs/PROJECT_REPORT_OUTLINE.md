# Project Report Outline

**Title:** Smart Campus Complaint Management System with AWS Cloud Automation and CI/CD

Suggested length: 40–60 pages. Section numbers below are a suggestion; follow your
university's template where it differs. Text in *italics* is guidance for you to
replace with your own writing.

---

**Front matter:** title page, certificate, declaration, acknowledgement, table of
contents, list of figures, list of tables, abbreviations (API, AWS, CI/CD, CORS,
CSRF, EB, ECR, GSI, IAM, IMDS, JWT, OIDC, RBAC, SDK, STS, XSS).

## Abstract (≈250 words)
*Problem (campus complaints handled informally, lost, untracked) → solution (web
portal with role-based dashboards) → technologies (React, Node.js/Express,
DynamoDB, Docker, GitHub Actions, Elastic Beanstalk, CloudWatch) → automation
(every push tested, containerised and deployed with OIDC, verified by health
checks) → results (state only what you measured: number of tests passing,
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
4. Store data in a managed cloud database (DynamoDB).
5. Package the application with Docker.
6. Automate testing and deployment with GitHub Actions and AWS (CI/CD).
7. Provide health checks and centralised logs (CloudWatch).

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

6.3 Hardware/software requirements (development machine, browsers, AWS services).

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
12.4 OIDC authentication flow diagram (GitHub → STS → temporary credentials).
12.5 Evidence: screenshots of a green run, a failing-test run, the deployment summary.
12.6 Measured timings from *your* runs (duration of each job).

## 13. AWS Cloud Architecture and Deployment
Services used and their roles; IAM roles and policies (least privilege discussion);
CloudFormation stack; Elastic Beanstalk configuration; logging and monitoring setup;
cost analysis (billable resources table from `docs/AWS_DEPLOYMENT.md` §0 with *your* Cost Explorer figures).

## 14. Testing
Methodology (unit/integration, mocked AWS, smoke, post-deployment, manual);
test case table T01–T50 and M01–M12 with **actual** results from your runs; coverage
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
9. GitHub: Configuring OpenID Connect in AWS — https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
10. AWS Elastic Beanstalk Developer Guide — https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/
11. Amazon DynamoDB Developer Guide — https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/
12. AWS IAM User Guide (roles, OIDC providers) — https://docs.aws.amazon.com/IAM/latest/UserGuide/
13. Amazon ECR User Guide — https://docs.aws.amazon.com/AmazonECR/latest/userguide/
14. Amazon CloudWatch Logs User Guide — https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/
15. AWS CloudFormation User Guide — https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/
16. AWS SDK for JavaScript v3 — https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/
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
9. Browser address bar showing the **Elastic Beanstalk URL** with the app loaded.
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
21. Deploy job: "Get temporary AWS credentials (OIDC)" step (no secrets used).
22. Deploy job summary with URL and version.
23. Repository variables page (values are not secret, but you may blur the account ID).
24. `production` environment with branch restriction.
25. A code change → merged PR → automatic deployment → changed page live.

**AWS**
26. CloudFormation stack `CREATE_COMPLETE` with its resources and outputs.
27. Elastic Beanstalk environment dashboard: Health Ok, running version label = commit.
28. Application versions list.
29. ECR repository with images tagged by commit SHA (and scan results).
30. DynamoDB tables, the two indexes, and "Explore items" showing stored complaints (hide password hashes or explain they are hashes).
31. IAM roles: instance role inline policy; deploy role trust policy showing the repo/environment condition.
32. CloudWatch log groups; a Logs Insights query result for `request completed`.
33. Elastic Beanstalk Monitoring tab graphs.
34. AWS Budgets alert configuration; Cost Explorer for the project period.
35. After cleanup: empty Beanstalk/EC2 consoles and the deleted stack.
