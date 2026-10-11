#!/usr/bin/env bash
# Deletes everything created for the project so that it stops costing money.
# This PERMANENTLY deletes the DynamoDB tables, container images and the
# Elastic Beanstalk environment.
#
# Usage: AWS_REGION=ap-south-1 ./infrastructure/destroy-stack.sh

set -euo pipefail

: "${AWS_REGION:?Set AWS_REGION to the region you deployed to}"
export AWS_REGION
STACK_NAME="${STACK_NAME:-smart-campus}"
APP_NAME="${APP_NAME:-smart-campus}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-smart-campus-prod}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
read -r -p "Delete stack '${STACK_NAME}' and ALL its data in ${ACCOUNT_ID}/${AWS_REGION}? Type 'delete' to continue: " answer
[[ "${answer}" == "delete" ]] || { echo "Cancelled."; exit 1; }

echo "==> Deleting CloudFormation stack (Elastic Beanstalk, DynamoDB, ECR, IAM roles)"
aws cloudformation delete-stack --stack-name "${STACK_NAME}"
aws cloudformation wait stack-delete-complete --stack-name "${STACK_NAME}"
echo "    Stack deleted"

BUCKET="elasticbeanstalk-${AWS_REGION}-${ACCOUNT_ID}"
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "==> Removing this app's deployment bundles from s3://${BUCKET}/${APP_NAME}/"
  aws s3 rm "s3://${BUCKET}/${APP_NAME}/" --recursive
  echo "    The bucket itself is shared by all Elastic Beanstalk apps in this region."
  echo "    If you have no other Elastic Beanstalk apps, you can delete it in the S3 console"
  echo "    (first remove its bucket policy, then empty and delete it)."
fi

echo "==> Remaining log groups (should be none):"
aws logs describe-log-groups --log-group-name-prefix "/aws/elasticbeanstalk/${ENVIRONMENT_NAME}" \
  --query "logGroups[].logGroupName" --output text || true
echo "Done. Check the AWS Billing console over the next few days to confirm charges have stopped."
