# AWS Deployment Guide (Beginner, Step by Step)

This guide takes you from an empty AWS account to an automatic pipeline:
`git push` → tests → Docker image → AWS Elastic Beanstalk → health check.

> **Honesty note.** The CloudFormation template and the workflow were written and
> checked with linters (`cfn-lint`, `actionlint`) and the Docker image was tested
> locally, but they have **not** been run against a real AWS account. AWS consoles
> and platform versions change, so if a screen looks different, follow the
> linked official documentation. Record what actually happens for your report.

## 0. What will be created, and what it costs

| Resource | Purpose | Billable? |
| --- | --- | --- |
| EC2 instance `t3.micro` (via Elastic Beanstalk) | Runs the Docker container | **Yes**, per hour while running |
| EBS volume (instance disk, ~8 GB) | Instance storage | **Yes**, per GB-month |
| Public IPv4 address (Elastic IP of the single instance) | Public URL | **Yes**, per hour (AWS charges for all public IPv4 addresses) |
| DynamoDB tables (on-demand) + indexes | Data | Per request and per GB stored; tiny for a demo |
| Amazon ECR repository | Docker images (lifecycle keeps the last 10) | Per GB-month stored |
| S3 bucket `elasticbeanstalk-<region>-<account>` | Deployment bundles (tiny) | Per GB-month |
| CloudWatch Logs (7-day retention) | Logs | Per GB ingested/stored |
| IAM roles, OIDC provider, Elastic Beanstalk itself | Permissions, orchestration | No charge |

Left running, the setup typically costs **roughly USD 10–15 per month**,
mostly the EC2 instance and the public IPv4 address. The exact amount depends
on the region and current prices; check the
[AWS Pricing Calculator](https://calculator.aws/). New AWS accounts may receive
Free Tier benefits or credits, but **do not assume the deployment is free**.

How to avoid surprises:
* Set a budget alert first (step 2).
* There is no load balancer and no NAT gateway, which are the usual expensive surprises.
* Delete everything with `infrastructure/destroy-stack.sh` once you are evaluated (step 14).
* While waiting between demos you can terminate the environment, or delete the whole stack and recreate it later (≈15 minutes).

## 1. Prerequisites

1. **An AWS account** (https://aws.amazon.com/). A payment card is required.
2. **Secure the root user:** enable MFA (Console → your name → Security credentials).
   Do not use the root user for daily work.
3. **Create your own admin identity.** The recommended way is IAM Identity Center
   ([guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html)):
   enable it, create a user, and assign the `AdministratorAccess` permission set to your account.
4. **Log in with the AWS CLI** (installed in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)).
   This uses temporary credentials, not long-lived access keys:
   ```bash
   aws configure sso          # follow the prompts; name the profile e.g. "student"
   export AWS_PROFILE=student
   aws sts get-caller-identity   # shows your account ID: login works
   ```
   When the session expires later, run `aws sso login`.
5. **The code on GitHub:** push this repository to your GitHub account. The default
   branch must be called `main`.

## 2. Create a budget alert (do this first)

Console → **Billing and Cost Management → Budgets → Create budget** →
"Use a template" → **Monthly cost budget** → amount e.g. `10` USD → your email →
Create. You receive emails at 85% and 100% of actual spend and when the forecast
exceeds the budget. ([Docs](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html))

## 3. Choose a region

Pick one region close to you and use it everywhere (CLI, console top-right
menu, GitHub variable). Examples: `ap-south-1` (Mumbai), `us-east-1`
(N. Virginia), `eu-west-1` (Ireland). All services used here are available in
these regions. The examples below use `ap-south-1`; replace it with yours.

## 4. Create all AWS resources with CloudFormation (recommended)

`infrastructure/cloudformation.yml` creates, in one stack:

* DynamoDB tables `smart-campus-users` and `smart-campus-complaints` (with both indexes)
* ECR repository `smart-campus`
* IAM role for the EC2 instance (DynamoDB access to only these tables, ECR pull, log streaming)
* IAM service role for Elastic Beanstalk (health monitoring, managed updates)
* Elastic Beanstalk application `smart-campus` and environment `smart-campus-prod`
  (Docker on Amazon Linux 2023, single `t3.micro` instance, enhanced health,
  health-check URL `/api/health`, CloudWatch log streaming with 7-day retention,
  application environment variables including a random `JWT_SECRET`)
* GitHub OIDC identity provider (if your account does not have one yet) and the
  deploy role `smart-campus-github-deploy-role`

Run it from the repository root:

```bash
cd ~/projects/smart-campus-complaint-portal
GITHUB_OWNER=<your-github-username> \
GITHUB_REPO=<your-repository-name> \
AWS_REGION=ap-south-1 \
./infrastructure/deploy-stack.sh
```

The script:
1. checks your AWS login,
2. finds the latest "Amazon Linux 2023 … running Docker" Elastic Beanstalk platform in your region,
3. checks whether a GitHub OIDC provider already exists,
4. generates a random JWT secret (only on first creation),
5. deploys the stack (10–15 minutes) and prints the outputs.

Watch progress in Console → **CloudFormation → Stacks → smart-campus → Events**.
When it finishes you see outputs such as:

| Output | Use |
| --- | --- |
| `DeployRoleArn` | GitHub variable `AWS_ROLE_ARN` |
| `ApplicationName` | GitHub variable `EB_APPLICATION_NAME` |
| `EnvironmentName` | GitHub variable `EB_ENVIRONMENT_NAME` |
| `EcrRepositoryName` | GitHub variable `ECR_REPOSITORY` |
| `EnvironmentURL` | Public address (shows the AWS sample app until your first deployment) |

> Until your first deployment the environment runs AWS's sample application,
> so its health may show as *Degraded/Severe* (the sample has no `/api/health`).
> That is expected and fixes itself after step 7.

If you prefer to understand each resource by clicking through the console,
use **Appendix A** instead of this step.

## 5. How the IAM permissions work (least privilege)

| Identity | Who uses it | Allowed to |
| --- | --- | --- |
| `smart-campus-eb-ec2-role` (instance profile) | The app on EC2, automatically, via temporary credentials | `GetItem`, `PutItem`, `UpdateItem`, `Query` on the two tables and their indexes only; pull from ECR; stream logs (AWS managed `AWSElasticBeanstalkWebTier`) |
| `smart-campus-eb-service-role` | Elastic Beanstalk itself | Monitor health and apply managed platform updates |
| `smart-campus-github-deploy-role` | GitHub Actions, via OIDC | Push to the `smart-campus` ECR repository only; upload bundles to the Beanstalk S3 bucket; deploy to Elastic Beanstalk; pass only this app's two roles |

The application has **no** AWS access keys: the AWS SDK automatically fetches
short-lived credentials for the instance role from the EC2 instance metadata
service.

**Trade-off to mention in the viva:** an Elastic Beanstalk deployment makes AWS
call CloudFormation, Auto Scaling, EC2 and S3 on the deployer's behalf, so AWS
provides the managed policy `AdministratorAccess-AWSElasticBeanstalk` for
deployers. Writing a tighter custom policy is possible but fragile. This project
uses the managed policy and limits **who** can assume the role instead: the
trust policy only accepts OIDC tokens issued for **this repository** running in
its **`production` GitHub environment**, and the role session lasts at most 1 hour.

## 6. Configure GitHub (OIDC + variables)

### 6.1 How OIDC works (in one paragraph)

When the deploy job starts, GitHub issues it a signed, short-lived identity
token that says "I am repository *owner/repo*, running in environment
*production*". The `aws-actions/configure-aws-credentials` action sends that token
to AWS STS. AWS checks the signature against the OIDC provider
(`token.actions.githubusercontent.com`) and the conditions in the role's trust
policy, and returns temporary credentials valid for up to an hour. No password or
access key is stored in GitHub.
([GitHub docs](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services),
[AWS docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html))

### 6.2 Create the `production` environment

GitHub repository → **Settings → Environments → New environment** → name it
exactly `production` → **Configure environment**:
* **Deployment branches and tags:** "Selected branches and tags" → add `main`.
* *(Optional)* **Required reviewers:** add yourself if you want to click
  "Approve" before each deployment (useful to control timing during a demo).

### 6.3 Add repository variables

**Settings → Secrets and variables → Actions → Variables tab → New repository variable**.
These are not secrets (they are names, not credentials):

| Name | Example value |
| --- | --- |
| `AWS_REGION` | `ap-south-1` |
| `AWS_ROLE_ARN` | `arn:aws:iam::<account-id>:role/smart-campus-github-deploy-role` (from the stack output) |
| `EB_APPLICATION_NAME` | `smart-campus` |
| `EB_ENVIRONMENT_NAME` | `smart-campus-prod` |
| `ECR_REPOSITORY` | `smart-campus` |

Until `AWS_ROLE_ARN` exists, the pipeline runs CI only and prints a notice that
deployment was skipped. The workflow already requests `id-token: write`
permission for the deploy job only; no other repository setting is needed.

## 7. First deployment

Either push any commit to `main`, or go to **Actions → CI/CD → Run workflow**
(on `main`). The run shows three jobs:

1. **CI: tests and frontend build** — `npm ci`, `npm run test:coverage`, frontend build.
2. **CI: Docker build and smoke test** — builds the image tagged with the commit
   SHA, starts it, checks `/api/health`, `/api/health/ready`, the homepage, and
   registers a user + creates a complaint through the API.
3. **CD: deploy to AWS Elastic Beanstalk** — assumes the role via OIDC, pushes the
   *same* image to ECR, writes a `Dockerrun.aws.json` that points at it, creates an
   application version, updates the environment, waits for `Ready`, then checks
   that `http://<env-url>/api/health` reports the new commit SHA and that
   `/api/health/ready` can reach DynamoDB.

The first deployment takes about 5–10 minutes. The job summary shows the URL.

## 8. Create the production administrator

From your computer, with the AWS CLI logged in as your admin identity:

```bash
cd backend
npm install     # if not done already
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
DB_DRIVER=dynamodb AWS_REGION=ap-south-1 USERS_TABLE=smart-campus-users \
ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@yourcollege.edu npm run create-admin
unset ADMIN_PASSWORD
```

Use a long, unique password (≥ 12 characters), and remember that the demo URL is
plain HTTP (see [SECURITY.md](SECURITY.md#known-limitations)).

## 9. Verify the public URL

```bash
aws elasticbeanstalk describe-environments --environment-names smart-campus-prod \
  --query "Environments[0].[CNAME,Status,Health,VersionLabel]" --output table
curl http://<CNAME>/api/health
curl http://<CNAME>/api/health/ready
```

Then open `http://<CNAME>` in a browser, register a student, submit a complaint,
log in as the admin and update it. In the console: **Elastic Beanstalk →
Environments → smart-campus-prod** should show Health **Ok** (green).

## 10. Automatic deployment after code changes

Make a visible change, for example the hero text in
`frontend/src/pages/Landing.jsx`, then:

```bash
git checkout -b feature/hero-text
git commit -am "Update landing page text"
git push -u origin feature/hero-text
```

Open a pull request: only CI runs (no deployment). Merge it into `main`: CI runs
again and then CD deploys automatically. Refresh the site to see the change and
check that `/api/health` reports the new commit SHA.

## 11. CloudWatch logs and monitoring

**Log groups** (Console → CloudWatch → Logs → Log groups), created by Elastic
Beanstalk log streaming:

| Log group | Contents |
| --- | --- |
| `/aws/elasticbeanstalk/smart-campus-prod/var/log/eb-docker/containers/eb-current-app/stdouterr.log` | **Application logs** (JSON lines from the Node.js app) |
| `/aws/elasticbeanstalk/smart-campus-prod/var/log/nginx/access.log` | Every HTTP request reaching nginx |
| `/aws/elasticbeanstalk/smart-campus-prod/var/log/eb-engine.log` | Deployment steps (useful when a deploy fails) |
| `/aws/elasticbeanstalk/smart-campus-prod/environment-health.log` | Enhanced health status changes |

**Logs Insights queries** (CloudWatch → Logs Insights → select the
`stdouterr.log` group):

```
# Errors and warnings
fields @timestamp, level, message, statusCode, path, errorMessage
| filter level = "error" or level = "warn"
| sort @timestamp desc
| limit 50

# Requests per endpoint and average latency
filter message = "request completed"
| stats count() as requests, avg(durationMs) as avgMs by method, path
| sort requests desc

# Status changes made by administrators
filter message = "complaint status updated"
| fields @timestamp, complaintId, status, adminId
```

**Health monitoring:**
* Elastic Beanstalk enhanced health (Environment → **Health** and **Monitoring**
  tabs) shows instance status, CPU and request metrics.
* `/api/health` is the Beanstalk health-check URL; `/api/health/ready` is checked by
  the pipeline after each deployment.
* *(Optional)* Create an alarm: Environment → Monitoring → the bell icon on
  "Environment health", or CloudWatch → Alarms on the `EnvironmentHealth`
  metric, with an SNS email notification. (Alarms may incur a small charge.)

You can also download all logs from the console: Environment → **Logs →
Request logs → Last 100 lines / Full logs**.

## 12. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `deploy-stack.sh`: "no … running Docker platform found" | Wrong region spelling, or the CLI is not logged in. Run `aws elasticbeanstalk list-available-solution-stacks` |
| Stack fails: `EntityAlreadyExists` for the OIDC provider | The provider already exists; the script detects it, so re-run the script. If created by another stack, keep `CreateGitHubOidcProvider=false` |
| Stack fails: role/table/repository already exists | A previous attempt left resources. Delete them (or the old stack) and retry |
| Stack rolled back during environment creation | Read the first `CREATE_FAILED` event in CloudFormation; then Elastic Beanstalk → Events |
| GitHub: `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `GITHUB_OWNER`/`GITHUB_REPO` in the stack don't match the repository (case-sensitive), the job isn't using the `production` environment, or `AWS_ROLE_ARN` is wrong |
| GitHub: `Credentials could not be loaded` | The `id-token: write` permission was removed from the deploy job |
| GitHub: deploy job never runs | It only runs for pushes to `main` when `AWS_ROLE_ARN` is set; check the "deployment skipped" notice |
| ECR push `AccessDenied` | `ECR_REPOSITORY` variable doesn't match the repository name in the stack |
| Beanstalk event: failed to pull image / `CannotPullContainerError` | Instance role lacks ECR read (check `AmazonEC2ContainerRegistryReadOnly`) or image tag missing in ECR |
| Environment Red, container exits immediately | Read `stdouterr.log`: usually a configuration error such as a missing `JWT_SECRET` (the app logs "invalid configuration") |
| `/api/health` OK but `/api/health/ready` returns 503 | DynamoDB access: check table names in the environment properties and the instance role policy. Search the app log for "readiness check failed" |
| Readiness log shows a credentials/IMDS timeout | The container cannot reach the instance metadata service. AL2023 instances default to a hop limit of 2 (needed for containers). If yours shows 1, run `aws ec2 modify-instance-metadata-options --instance-id <id> --http-put-response-hop-limit 2 --http-tokens required` |
| Login works then immediately logged out on AWS | `COOKIE_SECURE=true` over HTTP. Keep `false` until you add HTTPS |
| Pipeline: "running version X, expected Y" | The deployment failed and Beanstalk rolled back. See the printed events and `eb-engine.log` |
| Site unreachable | Environment still updating, or the instance was replaced: use the CNAME, not an IP |

## 13. What can be automated with CloudFormation or Terraform

| Step | Automated here? |
| --- | --- |
| DynamoDB tables and indexes, ECR, IAM roles, OIDC provider, Elastic Beanstalk app + environment, log streaming, environment variables | **Yes** — `cloudformation.yml` |
| Building, testing, pushing and deploying each version | **Yes** — GitHub Actions |
| AWS account, MFA, IAM Identity Center user, budget alert | No (one-time account setup; budgets *can* be automated with `AWS::Budgets::Budget` but needs your email) |
| GitHub environment and variables | No (could be scripted with the `gh` CLI) |
| First administrator | No, by design (a human chooses the password) |

Terraform could describe the same resources (`aws_dynamodb_table`,
`aws_elastic_beanstalk_environment`, …) but needs its own state storage
(S3 + locking) and another tool to learn. CloudFormation is built into AWS, so
it was chosen for a single-student project.

## 14. Cleanup after evaluation

```bash
AWS_REGION=ap-south-1 ./infrastructure/destroy-stack.sh
```

It asks you to type `delete`, deletes the stack (environment and EC2 instance,
Elastic IP, DynamoDB tables **and all data**, ECR repository and images, IAM
roles, OIDC provider if the stack created it, CloudWatch log groups) and removes
this app's bundles from the Elastic Beanstalk S3 bucket.

Then check manually:
1. Elastic Beanstalk console: no environments left.
2. EC2 console → Instances, Elastic IPs, Volumes: nothing left from the project.
3. S3: the shared `elasticbeanstalk-<region>-<account>` bucket — delete it if you
   have no other Beanstalk apps (remove its bucket policy, empty it, delete it).
4. GitHub: delete the `AWS_ROLE_ARN` variable so the pipeline stops trying to deploy.
5. Billing console over the next days: charges should drop to zero.

---

## Appendix A. Manual setup in the AWS Console (alternative to step 4)

Use this if you want to learn each service by hand. Use the same names as below
so that the rest of the guide works.

**A1. DynamoDB** (Console → DynamoDB → Create table):
* `smart-campus-users`: partition key `email` (String). Table settings →
  Customize → Capacity mode **On-demand**.
* `smart-campus-complaints`: partition key `complaintId` (String), On-demand.
  After creation: **Indexes → Create index**:
  * partition key `userId` (String), sort key `createdAt` (String), name
    `userId-createdAt-index`, projection All;
  * partition key `status` (String), sort key `createdAt` (String), name
    `status-createdAt-index`, projection All.

**A2. ECR** (Console → Elastic Container Registry → Create repository): private,
name `smart-campus`, enable scan on push.

**A3. Instance role** (IAM → Roles → Create role → AWS service → EC2):
attach `AWSElasticBeanstalkWebTier` and `AmazonEC2ContainerRegistryReadOnly`;
name it `smart-campus-eb-ec2-role`. Then **Add permissions → Create inline policy → JSON**
(replace region and account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      "Resource": [
        "arn:aws:dynamodb:ap-south-1:<account-id>:table/smart-campus-users",
        "arn:aws:dynamodb:ap-south-1:<account-id>:table/smart-campus-complaints",
        "arn:aws:dynamodb:ap-south-1:<account-id>:table/smart-campus-complaints/index/*"
      ]
    }
  ]
}
```

**A4. Elastic Beanstalk** (Console → Elastic Beanstalk → Create application):
* Environment tier **Web server**; application name `smart-campus`;
  environment name `smart-campus-prod`.
* Platform **Docker**, branch **Docker running on 64bit Amazon Linux 2023**.
* Application code **Sample application**. Presets **Single instance**.
* Service access: create/use the default service role; EC2 instance profile
  `smart-campus-eb-ec2-role`.
* Instance type `t3.micro`; IMDSv1 deactivated.
* Monitoring: health reporting **Enhanced**; health-check path `/api/health`
  (*if the field is offered*); **Log streaming** activated, retention 7 days,
  delete logs on termination.
* Environment properties: `NODE_ENV=production`, `DB_DRIVER=dynamodb`,
  `AWS_REGION=<region>`, `USERS_TABLE=smart-campus-users`,
  `COMPLAINTS_TABLE=smart-campus-complaints`, `COOKIE_SECURE=false`,
  `LOG_LEVEL=info`, `JWT_SECRET=<output of openssl rand -hex 32>`.

**A5. GitHub OIDC provider** (IAM → Identity providers → Add provider): type
OpenID Connect, URL `https://token.actions.githubusercontent.com`, audience
`sts.amazonaws.com`.

**A6. Deploy role** (IAM → Roles → Create role → Web identity → provider
`token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, your GitHub
organisation/user and repository). Attach `AdministratorAccess-AWSElasticBeanstalk`,
name it `smart-campus-github-deploy-role`. Then edit the **trust policy** so the
`sub` condition is exactly:

```json
"token.actions.githubusercontent.com:sub": "repo:<owner>/<repo>:environment:production"
```

and add an inline policy (replace region/account):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload",
        "ecr:DescribeImages", "ecr:GetDownloadUrlForLayer", "ecr:InitiateLayerUpload",
        "ecr:PutImage", "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:ap-south-1:<account-id>:repository/smart-campus"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:CreateBucket", "s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": [
        "arn:aws:s3:::elasticbeanstalk-ap-south-1-<account-id>",
        "arn:aws:s3:::elasticbeanstalk-ap-south-1-<account-id>/*"
      ]
    }
  ]
}
```

Continue with step 6. For cleanup of a manual setup, delete each resource in
reverse order in the console (environment, application, ECR repository, tables,
roles, provider).

## Official documentation used

* Elastic Beanstalk Docker platform: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_docker.html
* Dockerrun.aws.json v1 and ECR images: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/single-container-docker-configuration.html
* Using images from ECR: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/docker-configuration.remote-repo.html
* Supported platforms: https://docs.aws.amazon.com/elasticbeanstalk/latest/platforms/platforms-supported.html
* Beanstalk CloudWatch Logs: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/AWSHowTo.cloudwatchlogs.html
* Beanstalk option settings: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/command-options-general.html
* AL2023 IMDSv2 defaults: https://docs.aws.amazon.com/linux/al2023/ug/imdsv2.html
* GitHub OIDC with AWS: https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
* configure-aws-credentials action: https://github.com/aws-actions/configure-aws-credentials
* DynamoDB secondary indexes: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
* AWS Budgets: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
