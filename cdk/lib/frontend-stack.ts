
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

interface FrontendStackProps extends cdk.StackProps {
    stage: string;
}

export class FrontendStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        // 1. S3 Bucket for Static Assets
        const websiteBucket = new s3.Bucket(this, 'OnboardingBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Secure: OAI will be used
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/demo; use RETAIN for prod
            autoDeleteObjects: true,
        });

        // 2. CloudFront Distribution (S3 Origin with OAI)
        // S3Origin by default creates and uses an OAI if one isn't provided/OAC isn't used.
        this.distribution = new cloudfront.Distribution(this, 'OnboardingDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket), // This automatically configures OAI
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            // Clean error responses for SPA routing (Next.js)
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(0),
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html', // For client-side routing
                    ttl: cdk.Duration.minutes(0),
                },
            ],
        });

        // 3. Deployment
        new s3deploy.BucketDeployment(this, 'DeployOnboarding', {
            sources: [s3deploy.Source.asset(path.join(__dirname, '../../../chat-booking-onboarding/out'))],
            destinationBucket: websiteBucket,
            distribution: this.distribution,
            distributionPaths: ['/*'], // Invalidate cache
        });

        // Outputs
        new cdk.CfnOutput(this, 'CloudFrontURL', {
            value: this.distribution.distributionDomainName,
            description: 'The URL of the deployed onboarding application',
        });
    }
}
