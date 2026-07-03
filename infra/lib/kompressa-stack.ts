import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput, SecretValue } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class KompressaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const RETENTION_DAYS = 7;

    // ─── VPC (default) ───────────────────────────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    // ─── S3 ───────────────────────────────────────────────────
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `kompressa-uploads-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedHeaders: ['*'],
        maxAge: 3600,
      }],
      lifecycleRules: [
        {
          id: 'expire-uploads',
          enabled: true,
          expiration: Duration.days(RETENTION_DAYS),
        },
      ],
    });

    const outputsBucket = new s3.Bucket(this, 'OutputsBucket', {
      bucketName: `kompressa-outputs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'expire-outputs',
          enabled: true,
          expiration: Duration.days(RETENTION_DAYS),
        },
      ],
    });

    // ─── DynamoDB ─────────────────────────────────────────────
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: 'kompressa-jobs',
      partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // ─── Secrets Manager ──────────────────────────────────────
    const passwordHashSecret = new secretsmanager.Secret(this, 'PasswordHashSecret', {
      secretName: 'kompressa/password-hash',
      description: 'bcrypt hash of the single-admin password',
      secretStringValue: SecretValue.unsafePlainText('PLACEHOLDER_CHANGE_ME'),
    });

    const totpSecret = new secretsmanager.Secret(this, 'TotpSecret', {
      secretName: 'kompressa/totp-secret',
      description: 'Base32 TOTP shared secret (for password+TOTP 2FA)',
      generateSecretString: { passwordLength: 32, excludePunctuation: true },
    });

    const jwtSigningKey = new secretsmanager.Secret(this, 'JwtSigningKey', {
      secretName: 'kompressa/jwt-signing-key',
      description: 'HMAC-SHA256 signing key for session JWTs',
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    // ─── ECR for worker image ────────────────────────────────
    const workerRepo = new ecr.Repository(this, 'WorkerRepo', {
      repositoryName: 'kompressa-worker',
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [{ maxImageCount: 5 }],
    });

    // ─── ECS cluster + task role ─────────────────────────────
    const cluster = new ecs.Cluster(this, 'WorkerCluster', {
      clusterName: 'kompressa-cluster',
      vpc,
    });

    const taskRole = new iam.Role(this, 'WorkerTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    uploadsBucket.grantReadWrite(taskRole);
    outputsBucket.grantReadWrite(taskRole);
    jobsTable.grantReadWriteData(taskRole);
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:UpdateItem'],
        resources: [jobsTable.tableArn],
      }),
    );

    const executionRole = new iam.Role(this, 'WorkerExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    workerRepo.grantPull(executionRole);
    logs.LogGroup.fromLogGroupName(this, 'WorkerLogGroupRef', '/ecs/kompressa-worker');

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      family: 'kompressa-worker',
      cpu: 2048,
      memoryLimitMiB: 4096,
      executionRole,
      taskRole,
    });
    taskDefinition.addContainer('ffmpeg', {
      image: ecs.ContainerImage.fromEcrRepository(workerRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'kompressa-worker',
        logGroup: new logs.LogGroup(this, 'WorkerLogGroup', {
          logGroupName: '/ecs/kompressa-worker',
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
      environment: {
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        OUTPUTS_BUCKET: outputsBucket.bucketName,
        JOBS_TABLE: jobsTable.tableName,
        AWS_REGION: this.region,
      },
    });

    // ─── Lambda API ───────────────────────────────────────────
    const apiRole = new iam.Role(this, 'ApiRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });
    uploadsBucket.grantReadWrite(apiRole);
    outputsBucket.grantRead(apiRole);
    jobsTable.grantReadWriteData(apiRole);
    passwordHashSecret.grantRead(apiRole);
    totpSecret.grantRead(apiRole);
    jwtSigningKey.grantRead(apiRole);
    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask', 'ecs:DescribeTasks', 'ecs:StopTask'],
        resources: ['*'],
      }),
    );
    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskRole.roleArn, executionRole.roleArn],
      }),
    );

    const subnetIds = vpc.publicSubnets.slice(0, 2).map(s => s.subnetId);

    const apiFn = new lambda.Function(this, 'ApiFn', {
      functionName: 'kompressa-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      memorySize: 512,
      role: apiRole,
      code: lambda.Code.fromAsset('lambda-code'),
      environment: {
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        OUTPUTS_BUCKET: outputsBucket.bucketName,
        JOBS_TABLE: jobsTable.tableName,
        WORKER_CLUSTER: cluster.clusterName,
        WORKER_TASK_DEFINITION: taskDefinition.family,
        PASSWORD_HASH_SECRET: passwordHashSecret.secretName,
        TOTP_SECRET_SECRET: totpSecret.secretName,
        JWT_SIGNING_KEY_SECRET: jwtSigningKey.secretName,
        VPC_SUBNET_1: subnetIds[0] ?? '',
        VPC_SUBNET_2: subnetIds[1] ?? '',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    // ─── API Gateway HTTP API (no corsPreflight — Lambda handles CORS) ───
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'kompressa-api',
      description: 'Kompressa public API',
    });
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('ApiIntegration', apiFn),
    });

    // ─── Outputs ─────────────────────────────────────────────
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new CfnOutput(this, 'OutputsBucketName', { value: outputsBucket.bucketName });
    new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
    new CfnOutput(this, 'WorkerRepoUri', { value: workerRepo.repositoryUri });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'TaskDefinitionFamily', { value: taskDefinition.family });
  }
}
