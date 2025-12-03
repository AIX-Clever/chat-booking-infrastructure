#!/bin/bash
set -e

# Chat Booking SaaS - CloudFormation Deployment Script
# This script deploys the entire infrastructure using nested stacks

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

# S3 Buckets (these should exist before running)
TEMPLATES_BUCKET="${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}"
CODE_BUCKET="${PROJECT_NAME}-lambda-packages-${ENVIRONMENT}"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Chat Booking SaaS - CloudFormation Deploy${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo -e "Stack Name: ${YELLOW}${STACK_NAME}${NC}"
echo ""

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}ERROR: AWS CLI is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ AWS CLI found${NC}"
}

# Function to check if required buckets exist
check_buckets() {
    echo ""
    echo -e "${YELLOW}Checking S3 buckets...${NC}"
    
    if ! aws s3 ls "s3://${TEMPLATES_BUCKET}" &> /dev/null; then
        echo -e "${YELLOW}Creating templates bucket: ${TEMPLATES_BUCKET}${NC}"
        aws s3 mb "s3://${TEMPLATES_BUCKET}" --region "${REGION}"
        aws s3api put-bucket-versioning \
            --bucket "${TEMPLATES_BUCKET}" \
            --versioning-configuration Status=Enabled
    else
        echo -e "${GREEN}✓ Templates bucket exists${NC}"
    fi
    
    if ! aws s3 ls "s3://${CODE_BUCKET}" &> /dev/null; then
        echo -e "${YELLOW}Creating code bucket: ${CODE_BUCKET}${NC}"
        aws s3 mb "s3://${CODE_BUCKET}" --region "${REGION}"
    else
        echo -e "${GREEN}✓ Code bucket exists${NC}"
    fi
}

# Function to package Lambda functions
package_lambdas() {
    echo ""
    echo -e "${YELLOW}Packaging Lambda functions...${NC}"
    
    BACKEND_DIR="../../chat-booking-backend"
    
    if [ ! -d "${BACKEND_DIR}" ]; then
        echo -e "${RED}ERROR: Backend directory not found at ${BACKEND_DIR}${NC}"
        echo -e "${YELLOW}Please ensure the backend code is in the correct location${NC}"
        exit 1
    fi
    
    mkdir -p dist/functions dist/layers
    
    # Package each Lambda function
    for dir in auth_resolver catalog availability booking chat_agent; do
        if [ -d "${BACKEND_DIR}/${dir}" ]; then
            echo -e "  Packaging ${dir}..."
            cd "${BACKEND_DIR}/${dir}"
            pip install -r requirements.txt -t . --quiet
            zip -r -q "../../../cloudformation/dist/functions/${dir}.zip" . -x "*.pyc" "__pycache__/*" "tests/*"
            cd - > /dev/null
        fi
    done
    
    # Package shared layer
    if [ -d "${BACKEND_DIR}/shared" ]; then
        echo -e "  Packaging shared layer..."
        cd "${BACKEND_DIR}/shared"
        mkdir -p python
        pip install -r requirements.txt -t python/ --quiet 2>/dev/null || true
        cp -r *.py domain/ infrastructure/ python/ 2>/dev/null || true
        zip -r -q "../../cloudformation/dist/layers/shared-layer.zip" python/
        rm -rf python/
        cd - > /dev/null
    fi
    
    echo -e "${GREEN}✓ Lambda packages created${NC}"
}

# Function to upload code to S3
upload_code() {
    echo ""
    echo -e "${YELLOW}Uploading Lambda packages to S3...${NC}"
    
    aws s3 sync dist/functions/ "s3://${CODE_BUCKET}/functions/" --delete
    aws s3 sync dist/layers/ "s3://${CODE_BUCKET}/layers/" --delete
    
    echo -e "${GREEN}✓ Code uploaded${NC}"
}

# Function to upload templates to S3
upload_templates() {
    echo ""
    echo -e "${YELLOW}Uploading CloudFormation templates to S3...${NC}"
    
    aws s3 sync nested-stacks/ "s3://${TEMPLATES_BUCKET}/nested-stacks/" --delete
    aws s3 cp master-stack.yaml "s3://${TEMPLATES_BUCKET}/master-stack.yaml"
    
    echo -e "${GREEN}✓ Templates uploaded${NC}"
}

# Function to validate CloudFormation template
validate_template() {
    echo ""
    echo -e "${YELLOW}Validating CloudFormation template...${NC}"
    
    aws cloudformation validate-template \
        --template-url "https://${TEMPLATES_BUCKET}.s3.${REGION}.amazonaws.com/master-stack.yaml" \
        --region "${REGION}" > /dev/null
    
    echo -e "${GREEN}✓ Template is valid${NC}"
}

# Function to deploy CloudFormation stack
deploy_stack() {
    echo ""
    echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
    echo -e "${YELLOW}This may take 10-15 minutes...${NC}"
    echo ""
    
    aws cloudformation deploy \
        --template-file master-stack.yaml \
        --stack-name "${STACK_NAME}" \
        --parameter-overrides \
            Environment="${ENVIRONMENT}" \
            ProjectName="${PROJECT_NAME}" \
            S3BucketTemplates="${TEMPLATES_BUCKET}" \
            BackendCodeBucket="${CODE_BUCKET}" \
        --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
        --region "${REGION}" \
        --no-fail-on-empty-changeset
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Stack deployed successfully!${NC}"
    else
        echo -e "${RED}ERROR: Stack deployment failed${NC}"
        exit 1
    fi
}

# Function to get stack outputs
get_outputs() {
    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""
    
    echo -e "${YELLOW}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
    
    echo ""
    echo -e "${GREEN}GraphQL API URL:${NC}"
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiUrl`].OutputValue' \
        --output text
    
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo -e "  1. Test the GraphQL API using the URL above"
    echo -e "  2. Create your first tenant in DynamoDB"
    echo -e "  3. Generate API keys for widget authentication"
    echo -e "  4. Deploy the admin panel and widget"
    echo ""
}

# Main execution
main() {
    check_aws_cli
    check_buckets
    package_lambdas
    upload_code
    upload_templates
    validate_template
    deploy_stack
    get_outputs
}

# Run main function
main
