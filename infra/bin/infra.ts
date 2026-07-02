#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { KompressaStack } from '../lib/kompressa-stack';

const app = new App();

new KompressaStack(app, 'KompressaStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: 'Kompressa — video compression service (Fargate + Lambda + S3 + DynamoDB)',
});
