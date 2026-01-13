
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'path';

interface AssetsStackProps extends cdk.StackProps {
    stage: string;
}

export class AssetsStack extends cdk.Stack {
    public readonly assetsBucket: s3.Bucket;
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: AssetsStackProps) {
        super(scope, id, props);

        // 1. Assets Bucket (Private)
        this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
            bucketName: `chat-booking-assets-${props.stage}-${cdk.Aws.ACCOUNT_ID}`, // Unique name
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: props.stage !== 'prod',
            cors: [{
                allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                allowedOrigins: ['*'], // Restrict this in production to admin domain
                allowedHeaders: ['*'],
                exposedHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
                maxAge: 3000,
            }]
        });

        // 2. CloudFront Distribution (OAC)
        this.distribution = new cloudfront.Distribution(this, 'AssetsDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.assetsBucket), // OAI/OAC handled auto
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            comment: `Assets for Chat Booking (${props.stage})`,
        });

        // 3. Image Optimization Lambda
        // We need a layer with Pillow. For simplicity/speed in this context, 
        // we use a Klayers ARN for Python 3.9 or build it. 
        // Better to build it if we can, but defining the layer build for Pillow in CDK 
        // can be slow/complex without Docker.
        // Using a public ARN for now or assuming the layer exists in shared layers stack.
        // Let's rely on 'bundling' with Docker if possible, or use a prebuilt layer.
        // Given the constraints, I will assume we can bundle via Docker file or use a known generic ARN.
        // Let's try to lookup a layer or just use "bundling" with image.

        const optimizationFunction = new lambda.Function(this, 'ImageOptimizationFunction', {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../chat-booking-backend/assets/optimization'), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_9.bundlingImage,
                    command: [
                        'bash', '-c',
                        'pip install -t /asset-output Pillow && cp -au . /asset-output'
                    ],
                },
            }),
            timeout: cdk.Duration.seconds(30),
            memorySize: 1024, // Pillow needs memory
            environment: {
                BUCKET_NAME: this.assetsBucket.bucketName,
                DEST_PREFIX: 'optimized/',
            },
        });

        // Grant S3 Permissions
        this.assetsBucket.grantReadWrite(optimizationFunction);

        // 4. Trigger on Upload to 'raw/'
        this.assetsBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(optimizationFunction),
            { prefix: 'raw/' }
        );

        // Outputs
        new cdk.CfnOutput(this, 'AssetsBucketName', {
            value: this.assetsBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'AssetsDistributionDomain', {
            value: this.distribution.distributionDomainName,
        });
    }
}
