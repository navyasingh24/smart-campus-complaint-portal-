#!/usr/bin/env bash
# Creates or updates all AWS resources for the project with CloudFormation.
#
# Usage (from the repository root, with the AWS CLI logged in):
#   GITHUB_OWNER=your-github-user GITHUB_REPO=smart-campus-complaint-portal \
#   AWS_REGION=ap-south-1 ./infrastructure/deploy-stack.sh
#
# Optional: STACK_NAME (default smart-campus), APP_NAME (default smart-campus),
#           ENVIRONMENT_NAME (default smart-campus-prod), INSTANCE_TYPE (default t3.micro)

set -euo pipefail

: "${GITHUB_OWNER:?Set GITHUB_OWNER to your GitHub user or organisation name}"
: "${GITHUB_REPO:?Set GITHUB_REPO to your repository name}"
: "${AWS_REGION:?Set AWS_REGION, for example ap-south-1 or us-east-1}"
export AWS_REGION

STACK_NAME="${STACK_NAME:-smart-campus}"
APP_NAME="${APP_NAME:-smart-campus}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-smart-campus-prod}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
TEMPLATE="$(dirname "$0")/cloudformation.yml"

echo "==> Checking AWS credentials"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "    Account: ${ACCOUNT_ID}  Region: ${AWS_REGION}"

echo "==> Finding the latest Elastic Beanstalk Docker platform on Amazon Linux 2023"
SOLUTION_STACK=$(aws elasticbeanstalk list-available-solution-stacks \
  --query "SolutionStacks[?starts_with(@, '64bit Amazon Linux 2023') && ends_with(@, 'running Docker')]" \
  --output text | tr '\t' '\n' | sort -V | tail -n 1)
if [[ -z "${SOLUTION_STACK}" ]]; then
  echo "ERROR: no 'Amazon Linux 2023 ... running Docker' platform found in ${AWS_REGION}" >&2
  exit 1
fi
echo "    Platform: ${SOLUTION_STACK}"

echo "==> Checking whether the GitHub OIDC provider already exists"
if aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[].Arn" --output text \
  | grep -q "oidc-provider/token.actions.githubusercontent.com"; then
  CREATE_OIDC=false
  echo "    Found existing provider; it will be reused"
else
  CREATE_OIDC=true
  echo "    Not found; the stack will create it"
fi
# If this stack created the provider earlier, keep managing it.
if aws cloudformation describe-stack-resource --stack-name "${STACK_NAME}" \
  --logical-resource-id GitHubOidcProvider >/dev/null 2>&1; then
  CREATE_OIDC=true
fi

PARAMS=(
  "AppName=${APP_NAME}"
  "EnvironmentName=${ENVIRONMENT_NAME}"
  "SolutionStackName=${SOLUTION_STACK}"
  "InstanceType=${INSTANCE_TYPE}"
  "GitHubOwner=${GITHUB_OWNER}"
  "GitHubRepo=${GITHUB_REPO}"
  "CreateGitHubOidcProvider=${CREATE_OIDC}"
)

if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" >/dev/null 2>&1; then
  # 'aws cloudformation deploy' re-uses the previous value of any parameter
  # that is not overridden, so the existing JwtSecret is kept.
  echo "==> Stack exists: keeping the existing JWT secret"
else
  echo "==> New stack: generating a random JWT secret"
  PARAMS+=("JwtSecret=$(openssl rand -hex 32)")
fi

echo "==> Deploying CloudFormation stack '${STACK_NAME}' (this can take 10-15 minutes)"
aws cloudformation deploy \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAMS[@]}"

echo "==> Stack outputs"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table

cat <<INFO

Next steps - add these as GitHub repository variables
(Settings > Secrets and variables > Actions > Variables):
  AWS_REGION           = ${AWS_REGION}
  AWS_ROLE_ARN         = (DeployRoleArn above)
  EB_APPLICATION_NAME  = (ApplicationName above)
  EB_ENVIRONMENT_NAME  = (EnvironmentName above)
  ECR_REPOSITORY       = (EcrRepositoryName above)
INFO
