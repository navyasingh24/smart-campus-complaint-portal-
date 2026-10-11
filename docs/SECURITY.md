# Security

| Threat | Control | Where |
| --- | --- | --- |
| Stolen password database | bcrypt hashes (cost 10, per-password salt) | `routes/auth.js` |
| Password guessing | Rate limit: 20 auth requests / 15 min / IP; same error for unknown email and wrong password; constant-time-style comparison against a dummy hash | `routes/auth.js` |
| Token theft via XSS | JWT in an `httpOnly` cookie (not readable by JavaScript); React escapes all output; Content-Security-Policy from helmet | `routes/auth.js`, `app.js` |
| Forged tokens | HS256 signature with a ≥32-character secret from the environment; algorithm pinned; 8-hour expiry | `middleware/auth.js`, `config.js` |
| CSRF | `SameSite=Strict` cookie, plus state-changing requests must be `application/json` (an HTML form on another site cannot send that without a CORS preflight, which is refused) | `app.js` |
| Cross-origin data access | CORS denies all origins unless listed in `CORS_ORIGINS` | `app.js` |
| Privilege escalation | Registration always creates `STUDENT`; admins only via `create-admin` script; role checked **on the server** for every admin route | `routes/auth.js`, `routes/admin.js` |
| Reading/modifying others' complaints (IDOR) | Owner always taken from the token; list queries use the token's userId; single-item reads return 404 unless owner or admin; students cannot update status | `routes/complaints.js` |
| Malicious input | Server-side validation of every field, length limits, enum checks, 20 KB body limit, UUID format check | `validation.js`, `app.js` |
| Information leakage | Unexpected errors return a generic message; details (with stack) only in server logs; `X-Powered-By` removed; request bodies never logged | `middleware/errorHandler.js`, `middleware/requestLogger.js` |
| Leaked cloud credentials | No AWS keys anywhere: EC2 uses an instance role; GitHub uses OIDC with a trust policy limited to this repository's `production` environment | `infrastructure/cloudformation.yml` |
| Excess cloud permissions | App role can only Get/Put/Update/Query its two tables; deploy role can push only to its ECR repository and pass only this app's roles | `infrastructure/cloudformation.yml` |
| Running as root in the container | Image runs as the unprivileged `node` user | `Dockerfile` |
| Secrets in Git | `.env` files ignored by Git and Docker; only `.env.example` templates are committed | `.gitignore`, `.dockerignore` |

## Creating the first administrator securely

There is **no default admin account**. Create one with the script; the password
is read from an environment variable that you type without echo, so it never
appears in source code or shell history.

**Locally (JSON database):**

```bash
cd backend
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@example.edu npm run create-admin
unset ADMIN_PASSWORD
```

**On AWS (production DynamoDB)** — run from your own computer with the AWS
CLI logged in (`aws sso login` or `aws configure`) as a user allowed to write to
the table:

```bash
cd backend
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
DB_DRIVER=dynamodb AWS_REGION=ap-south-1 USERS_TABLE=smart-campus-users \
ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@yourcollege.edu npm run create-admin
unset ADMIN_PASSWORD
```

Admin passwords must be at least 12 characters. The script refuses to overwrite
an existing account.

## Known limitations

* **No HTTPS on the default Elastic Beanstalk URL.** A single-instance
  environment has no load balancer, so the `*.elasticbeanstalk.com` URL is plain
  HTTP and cookies are sent without the `Secure` flag (`COOKIE_SECURE=false`).
  Passwords travel unencrypted on the network. For real use: add a domain and an
  ACM certificate on a load-balanced environment (or CloudFront in front), then
  set `COOKIE_SECURE=true`. Do not use real passwords on the demo deployment.
* The JWT secret is stored as an Elastic Beanstalk environment property (visible
  to anyone with console access to the environment). AWS Secrets Manager or SSM
  Parameter Store would be the next step.
* Tokens cannot be revoked before they expire (8 hours); logout only deletes the cookie.
* The rate limiter keeps counters in memory, so it resets on restart and would
  not be shared between multiple instances.
