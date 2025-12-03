#!/bin/bash
set -e

# Chat Booking SaaS - CloudFormation Validation Script
# Validates all templates before deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Validating CloudFormation Templates${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

validate_template() {
    local file=$1
    local name=$(basename "$file")
    
    echo -n "Validating ${name}... "
    
    if aws cloudformation validate-template \
        --template-body file://"${file}" \
        --region "${REGION}" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}Error validating ${name}${NC}"
        aws cloudformation validate-template \
            --template-body file://"${file}" \
            --region "${REGION}" 2>&1 | head -20
        return 1
    fi
}

# Validate nested stacks
errors=0
for file in nested-stacks/*.yaml; do
    if [ -f "$file" ]; then
        validate_template "$file" || ((errors++))
    fi
done

# Validate master stack
validate_template "master-stack.yaml" || ((errors++))

echo ""
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✓ All templates are valid!${NC}"
    exit 0
else
    echo -e "${RED}✗ Found ${errors} error(s)${NC}"
    exit 1
fi
