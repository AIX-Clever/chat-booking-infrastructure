
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

interface EmbeddedWidgetStackProps extends cdk.StackProps {
    stage: string;
}

export class EmbeddedWidgetStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: EmbeddedWidgetStackProps) {
        super(scope, id, props);

        // 1. S3 Bucket for Widget Assets
        const widgetBucket = new s3.Bucket(this, 'WidgetBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/demo
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ['*'], // Allow loading from any domain
                    allowedHeaders: ['*'],
                }
            ]
        });

        // 2. CloudFront Distribution
        this.distribution = new cloudfront.Distribution(this, 'WidgetDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(widgetBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'WidgetCorsPolicy', {
                    corsBehavior: {
                        accessControlAllowCredentials: false,
                        accessControlAllowHeaders: ['*'],
                        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
                        accessControlAllowOrigins: ['*'], // Critical for embedded widget
                        originOverride: true,
                    }
                })
            },
            defaultRootObject: 'demo-prod.html', // Optional entry point if visited directly
        });

        // 3. Deployment
        // Allow overriding path via env var (useful for CI/CD), otherwise use local relative path
        const widgetDistPath = process.env.WIDGET_DIST_PATH || path.join(__dirname, '../../../chat-booking-embedded-widget/dist');

        new s3deploy.BucketDeployment(this, 'DeployWidget', {
            sources: [s3deploy.Source.asset(widgetDistPath)],
            destinationBucket: widgetBucket,
            distribution: this.distribution,
            distributionPaths: ['/*'],
        });

        // Outputs
        new cdk.CfnOutput(this, 'WidgetUrl', {
            value: this.distribution.distributionDomainName,
            description: 'The URL of the deployed widget distribution',
        });

        new cdk.CfnOutput(this, 'WidgetScriptUrl', {
            value: `https://${this.distribution.distributionDomainName}/booking-widget.js`,
            description: 'The absolute URL for the widget script',
        });

        new cdk.CfnOutput(this, 'WidgetCssUrl', {
            value: `https://${this.distribution.distributionDomainName}/booking-widget.css`,
            description: 'The absolute URL for the widget CSS',
        });
    }
}
