#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
// Imports updated
import { FrontendStack } from '../lib/frontend-stack';

/**
 * CDK App Entry Point
 * 
 * Instantiates and connects all infrastructure stacks:
 * 1. Database (DynamoDB tables)
 * 2. Lambda (Functions and layers)
 * 3. AppSync API (GraphQL API)
 * 4. Auth (Cognito User Pool)
 * 
 * Stack dependencies:
 * Lambda -> Database
 * AppSync -> Lambda
 * Auth (independent)
 */

const app = new cdk.App();

// Get environment from context or env var
const env = app.node.tryGetContext('env') || process.env.ENV || 'dev';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Common tags for all resources
const tags = {
  Project: 'ChatBooking',
  Environment: env,
  ManagedBy: 'CDK-Infrastructure',
};

// Stack naming convention
const stackPrefix = `ChatBooking-${env}`;

import { FrontendStack } from '../lib/frontend-stack';

// 5. Frontend Stack - Onboarding App
const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  env: { account, region },
  description: 'S3 + CloudFront for Chat Booking Onboarding',
  tags,
  stage: env,
});

// Add stack outputs summary
new cdk.CfnOutput(app, 'DeploymentSummary', {
  value: JSON.stringify({
    environment: env,
    region,
    onboardingUrl: frontendStack.distribution.distributionDomainName,
  }),
  description: 'Deployment summary',
});

// Synth the app
app.synth();
