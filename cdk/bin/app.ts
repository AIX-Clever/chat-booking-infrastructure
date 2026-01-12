#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { AppSyncApiStack } from '../lib/appsync-api-stack';
import { AuthStack } from '../lib/auth-stack';

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
  ManagedBy: 'CDK',
};

// Stack naming convention
const stackPrefix = `ChatBooking-${env}`;

// 1. Database Stack - Foundation
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env: { account, region },
  description: 'DynamoDB tables for Chat Booking SaaS',
  tags,
});

// 2. Lambda Stack - Business Logic
const lambdaStack = new LambdaStack(app, `${stackPrefix}-Lambda`, {
  env: { account, region },
  description: 'Lambda functions for Chat Booking SaaS',
  tags,
  tenantsTable: databaseStack.tenantsTable,
  apiKeysTable: databaseStack.apiKeysTable,
  servicesTable: databaseStack.servicesTable,
  providersTable: databaseStack.providersTable,
  availabilityTable: databaseStack.availabilityTable,
  bookingsTable: databaseStack.bookingsTable,
  conversationsTable: databaseStack.conversationsTable,
});
lambdaStack.addDependency(databaseStack);

// 3. AppSync API Stack - GraphQL Gateway
const appSyncApiStack = new AppSyncApiStack(app, `${stackPrefix}-AppSyncApi`, {
  env: { account, region },
  description: 'GraphQL API for Chat Booking SaaS',
  tags,
  authResolverFunction: lambdaStack.authResolverFunction,
  catalogFunction: lambdaStack.catalogFunction,
  availabilityFunction: lambdaStack.availabilityFunction,
  bookingFunction: lambdaStack.bookingFunction,
  chatAgentFunction: lambdaStack.chatAgentFunction,
});
appSyncApiStack.addDependency(lambdaStack);

import { FrontendStack } from '../lib/frontend-stack';

// ... (existing imports)

// ... (existing code)

// 4. Auth Stack - Cognito for Admin Panel
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  env: { account, region },
  description: 'Cognito User Pool for Chat Booking Admin',
  tags,
});
// Auth stack is independent

// 5. Frontend Stack - Onboarding App
const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  env: { account, region },
  description: 'S3 + CloudFront for Chat Booking Onboarding',
  tags,
  stage: env,
});

import { EmbeddedWidgetStack } from '../lib/embedded-widget-stack';

// 6. Embedded Widget Stack
const widgetStack = new EmbeddedWidgetStack(app, `${stackPrefix}-EmbeddedWidget`, {
  env: { account, region },
  description: 'S3 + CloudFront for Embedded Booking Widget',
  tags,
  stage: env,
});

// Add stack outputs summary
new cdk.CfnOutput(appSyncApiStack, 'DeploymentSummary', {
  value: JSON.stringify({
    environment: env,
    region,
    graphqlEndpoint: appSyncApiStack.api.graphqlUrl,
    userPoolId: authStack.userPool.userPoolId,
    onboardingUrl: frontendStack.distribution.distributionDomainName,
    widgetUrl: widgetStack.distribution.distributionDomainName,
  }),
  description: 'Deployment summary',
});

// Synth the app
app.synth();
