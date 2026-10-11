# Testing

## 1. Strategy

| Level | Tool | What it proves | Runs where |
| --- | --- | --- | --- |
| API / integration tests | Jest + Supertest | Each endpoint's behaviour, validation, authentication and authorization through the real Express app | Locally and in CI (`test` job) |
| Database adapter tests | Jest + aws-sdk-client-mock | The DynamoDB adapter sends the right `Query`/`PutItem`/`UpdateItem` requests (indexes, conditions, pagination), never a `Scan` | Locally and in CI |
| Persistence tests | Jest + temporary files | The local adapter keeps data across restarts | Locally and in CI |
| Build checks | Vite, Docker | The frontend compiles; the image builds | CI (`test`, `docker` jobs) |
| Container smoke test | curl in GitHub Actions | The built image starts, serves the UI, and can register a user and create a complaint | CI (`docker` job) |
| Post-deployment check | curl in GitHub Actions | AWS serves the new version and can reach DynamoDB | CD (`deploy` job) |
| Manual end-to-end | Browser | The complete user journey | You, before the demo |

Tests use an **in-memory database** created fresh for each test file, and the
DynamoDB tests replace the AWS SDK with a mock. Tests therefore never modify
real data, never need AWS credentials and cost nothing.

## 2. Running the tests

```bash
cd backend
npm test                # run everything
npm run test:coverage   # also writes coverage/lcov-report/index.html
npx jest -t "another student"   # only tests whose name matches
```

### Reading the output

```
PASS tests/admin.test.js
  Administrator operations
    ✓ students are forbidden from all admin endpoints (… ms)
...
Test Suites: 8 passed, 8 total
Tests:       67 passed, 67 total
```

* `PASS` / `✓`: the expectation held. `FAIL` / `✕`: Jest prints the test name,
  the expected vs. received values, and the line number. Example: `Expected: 403,
  Received: 200` on an admin test would mean a student could reach an admin route.
* The coverage table shows which percentage of statements, branches, functions
  and lines ran during the tests. Uncovered line numbers are listed on the right.
* The command exits with code `0` only if every test passed; GitHub Actions uses
  that exit code to stop the pipeline.

## 3. Automated test cases

| ID | Requirement | Test (file › name) | Expected |
| --- | --- | --- | --- |
| T01 | Health check | health › GET /api/health returns ok with version information | 200, `status: ok`, version |
| T02 | Health check (DB) | health › GET /api/health/ready reports database connectivity | 200 |
| T03 | Health check failure | health › …returns 503 when the database is unreachable | 503, no internal error text |
| T04 | Logging | health › API requests are logged as JSON without bodies… | One JSON log line, password absent |
| T05 | Registration | auth › a student can register and receives an httpOnly session cookie | 201, cookie `HttpOnly; SameSite=Strict`, hash stored |
| T06 | No self-made admins | auth › registration cannot be used to create an administrator | role `STUDENT` |
| T07 | Registration validation | auth › registration rejects invalid input with field errors | 400 with name/email/password errors |
| T08 | Unique email | auth › registration rejects a duplicate email | 409 |
| T09 | Login | auth › login succeeds with correct credentials | 200 + cookie |
| T10 | Invalid authentication | auth › login fails with a wrong password / unknown email | 401, same message |
| T11 | Unauthorized request | auth › GET /api/auth/me returns 401 without a session | 401 |
| T12 | Forged token | auth › a token signed with a different secret is rejected | 401 |
| T13 | Expired token | auth › an expired token is rejected | 401 |
| T14 | Logout | auth › logout clears the session cookie | Cookie cleared, then 401 |
| T15 | Brute-force protection | auth › login is rate limited after too many attempts | 429 |
| T16 | Complaint creation | complaints › a student can create a complaint | 201, `PENDING`, owner = student |
| T17 | Optional location | complaints › the location is optional | 201, `location: null` |
| T18 | Mass-assignment protection | complaints › the server ignores attempts to set status or owner | `PENDING`, real owner |
| T19 | Invalid complaint data | complaints › invalid complaint data is rejected (5 cases) | 400, nothing stored |
| T20 | Unauthorized request | complaints › creating a complaint without logging in returns 401 | 401 |
| T21 | CSRF defence | complaints › non-JSON request bodies are rejected | 415 |
| T22 | Complaint listing | complaints › a student only sees their own complaints, newest first | Own items, sorted |
| T23 | Other students' complaints | complaints › query parameters cannot be used to list another student's complaints | Empty list |
| T24 | Filters | complaints › complaints can be filtered by category and status | Correct subsets; invalid filter → 400 |
| T25 | View own complaint | complaints › a student can view their own complaint by id | 200 |
| T26 | Other students' complaints | complaints › a student cannot view another student's complaint | 404 |
| T27 | Input validation | complaints › a malformed complaint id is rejected | 400 |
| T28 | Role separation | complaints › an administrator can view any complaint by id but cannot submit complaints | 200 / 403 |
| T29 | Admin-only operations | admin › students are forbidden from all admin endpoints | 403 ×3 |
| T30 | Unauthorized request | admin › anonymous users get 401 from admin endpoints | 401 |
| T31 | Admin listing | admin › an admin can list all complaints with student details | All complaints |
| T32 | Admin filters | admin › an admin can filter complaints by status and category | Correct subsets |
| T33 | Status update | admin › an admin can update a complaint status and the student sees it | 200, student sees new status |
| T34 | Status validation | admin › an invalid status is rejected | 400 |
| T35 | Status update (missing) | admin › updating a complaint that does not exist returns 404 | 404 |
| T36 | Dashboard statistics | admin › dashboard statistics reflect status changes | Exact counts |
| T37 | CORS | security › cross-origin requests from unknown origins are not allowed / configured origins are allowed | No / correct header |
| T38 | Security headers | security › security headers are set and the framework is not advertised | nosniff, CSP, no X-Powered-By |
| T39 | Safe errors | security › unexpected errors return a generic message without internal details | 500 generic |
| T40 | Malformed JSON | security › malformed JSON returns 400 | 400 |
| T41 | Secure configuration | security › production configuration refuses to start without a strong JWT secret | Throws |
| T42 | Persistence | localStore › data persists across restarts when a file is configured | Data reloaded |
| T43 | Data isolation | localStore › returned objects are copies… | Stored data unchanged |
| T44 | DB: unique users | dynamoStore › creating a user uses a conditional put… / duplicate → 409 | Condition set, 409 |
| T45 | DB: efficient queries | dynamoStore › a student's complaints are read with a Query on the user index, never a Scan | `userId-createdAt-index`, no Scan |
| T46 | DB: pagination | dynamoStore › query results are paginated using LastEvaluatedKey | Second page requested |
| T47 | DB: admin list | dynamoStore › listing all complaints queries each status partition and merges newest first | 3 queries, merged order |
| T48 | DB: status update | dynamoStore › status updates are conditional… / missing → null | Condition set |
| T49 | DB: statistics | dynamoStore › statistics are counted from the status index with a small projection | Correct counts, projection |
| T50 | Admin creation | adminService › creates an administrator with a hashed password / rejects short passwords / refuses to overwrite | ADMIN role, errors |

## 4. Manual test cases (run before the demo; record pass/fail with screenshots)

| ID | Steps | Expected |
| --- | --- | --- |
| M01 | Open the landing page on desktop and phone width (browser dev tools) | Responsive layout, buttons visible |
| M02 | Register with mismatched passwords | Inline error, no request sent |
| M03 | Register a student | Redirected to "My complaints" with empty state |
| M04 | Submit a complaint with an empty form | Field errors shown |
| M05 | Submit a valid complaint | Success message, complaint listed as Pending |
| M06 | Filter by category/status | List updates; "Clear filters" resets |
| M07 | As a student, type `/admin` in the address bar | Redirected to the student dashboard |
| M08 | Log in as admin with a wrong password | "Invalid email or password" |
| M09 | Admin: open "Manage", set In Progress with a note | Success message, cards and charts update |
| M10 | Log back in as the student | New status badge and admin note visible |
| M11 | Restart the backend / container | All data still present |
| M12 | Stop the backend while the page is open and click something | Clear error message, no crash |

## 5. Pipeline evidence

In GitHub, open **Actions → CI/CD → a run**. A successful run shows three green
jobs. To demonstrate that failing tests stop the pipeline, push a branch where a
test expectation is wrong (e.g. change `toBe(201)` to `toBe(200)` in
`complaints.test.js`), open a pull request, and screenshot the red ❌ with the
failing assertion. Then revert it.
