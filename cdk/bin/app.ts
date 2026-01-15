#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

/**
 * DEPRECATED:
 * This repository's infrastructure code has been migrated to the individual service repositories.
 * - Backend: chat-booking-backend/infra
 * - Admin: chat-booking-admin/infra
 * - Widget: chat-booking-embedded-widget/infra
 * - Onboarding: chat-booking-onboarding/infra
 */

const app = new cdk.App();
// No stacks defined.
app.synth();
