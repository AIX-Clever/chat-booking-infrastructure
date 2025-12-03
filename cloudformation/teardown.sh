#!/bin/bash
set -e

# Chat Booking SaaS - CloudFormation Teardown Script
# This script deletes the entire infrastructure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
PROJECT_NAME="ChatBooking"
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}"

echo -e "${RED}=====================================${NC}"
echo -e "${RED}⚠️  WARNING: INFRASTRUCTURE DELETION${NC}"
echo -e "${RED}=====================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo -e "Stack Name: ${YELLOW}${STACK_NAME}${NC}"
echo ""
echo -e "${RED}This will DELETE:${NC}"
echo -e "  - All DynamoDB tables and their data"
echo -e "  - All Lambda functions"
echo -e "  - AppSync API"
echo -e "  - Cognito User Pool (users will be deleted)"
echo -e "  - CloudWatch alarms and dashboards"
echo ""

read -p "Are you absolutely sure? Type 'DELETE' to confirm: " confirmation

if [ "$confirmation" != "DELETE" ]; then
    echo -e "${GREEN}Aborted. No changes made.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Deleting CloudFormation stack...${NC}"
echo -e "${YELLOW}This may take 10-15 minutes...${NC}"
echo ""

aws cloudformation delete-stack \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}"

echo -e "${YELLOW}Waiting for stack deletion to complete...${NC}"
aws cloudformation wait stack-delete-complete \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Stack deleted successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Remember to manually delete S3 buckets if needed:${NC}"
    echo -e "  - ${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}"
    echo -e "  - ${PROJECT_NAME}-lambda-packages-${ENVIRONMENT}"
else
    echo -e "${RED}ERROR: Stack deletion failed${NC}"
    echo -e "${YELLOW}Check CloudFormation console for details${NC}"
    exit 1
fi
