
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
    public readonly widgetUrl: string;

    constructor(scope: Construct, id: string, props: EmbeddedWidgetStackProps) {
        super(scope, id, props);

        // 1. S3 Bucket for Widget Assets
        const widgetBucket = new s3.Bucket(this, 'WidgetBucket', {
            // Secure but allows CloudFront access
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev; use RETAIN for prod
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ['*'], // Allow loading from any domain (holalucia.cl, localhost, etc.)
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
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                compress: true,
            },
            defaultRootObject: 'chat-widget.js', // Serve the main script by default if root is accessed
            comment: `Widget Distribution (${props.stage}) - No IP Restriction`,
        });

        // 3. Deployment (Upload dist folder)
        new s3deploy.BucketDeployment(this, 'DeployWidget', {
            sources: [s3deploy.Source.asset(path.join(__dirname, '../../../chat-booking-widget/dist'))],
            destinationBucket: widgetBucket,
            distribution: this.distribution,
            distributionPaths: ['/*'], // Invalidate cache on deploy
        });

        // Outputs
        this.widgetUrl = `https://${this.distribution.distributionDomainName}/chat-widget.js`;

        new cdk.CfnOutput(this, 'WidgetUrl', {
            value: this.widgetUrl,
            description: 'URL for the embedded chat widget script',
        });

        new cdk.CfnOutput(this, 'DistributionId', {
            value: this.distribution.distributionId,
            description: 'CloudFront Distribution ID',
        });
    }
}
