import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

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
      generateSecretString: { excludeLowercase: false, excludeUppercase: false, passwordLength: 0 },
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

    const apiFn = new lambda.Function(this, 'ApiFn', {
      functionName: 'kompressa-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { createHmac, randomUUID, timingSafeEqual } = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

const ecs = new ECSClient({});
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const sm = new SecretsManagerClient({});

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type' };

const secrets = {};
async function loadSecret(name) {
  if (secrets[name]) return secrets[name];
  const out = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  secrets[name] = out.SecretString;
  return secrets[name];
}

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

async function verifySession(event) {
  const cookie = event.headers?.cookie ?? event.headers?.Cookie ?? '';
  const m = cookie.match(/session=([^;]+)/);
  if (!m) return null;
  try {
    const key = await loadSecret(process.env.JWT_SIGNING_KEY_SECRET);
    return jwt.verify(m[1], key);
  } catch { return null; }
}

exports.handler = async (event) => {
  const path = event.rawPath ?? event.path ?? '';
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';
  if (method === 'OPTIONS') return json(200, {});

  try {
    if (path === '/api/login' && method === 'POST') {
      const { password, totp } = JSON.parse(event.body ?? '{}');
      const [hash, tSecret, key] = await Promise.all([
        loadSecret(process.env.PASSWORD_HASH_SECRET),
        loadSecret(process.env.TOTP_SECRET_SECRET),
        loadSecret(process.env.JWT_SIGNING_KEY_SECRET),
      ]);
      const ok = await bcrypt.compare(password ?? '', hash);
      const totpOk = speakeasy.totp.verify({ secret: tSecret, encoding: 'base32', token: String(totp ?? '') });
      if (!ok || !totpOk) return json(401, { error: { code: 'invalid_credentials', message: 'Invalid credentials' } });
      const token = jwt.sign({ sub: 'admin' }, key, { expiresIn: '12h' });
      return { statusCode: 200, headers: { 'Set-Cookie': \`session=\${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200\`, 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify({ expires_at: Date.now() + 12*3600*1000 }) };
    }

    const session = await verifySession(event);
    if (!session && path !== '/api/session') return json(401, { error: { code: 'unauthorized', message: 'Auth required' } });

    if (path === '/api/session' && method === 'GET') {
      return json(200, { authenticated: !!session });
    }

    if (path === '/api/uploads' && method === 'POST') {
      const file_id = randomUUID();
      const cmd = new PutObjectCommand({ Bucket: process.env.UPLOADS_BUCKET, Key: \`uploads/\${file_id}\` });
      const upload_url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
      return json(200, { upload_url, file_id, expires_at: Date.now() + 900*1000 });
    }

    if (path === '/api/compress' && method === 'POST') {
      const { file_id, target_size_mb, codec, max_resolution, audio_bitrate_kbps } = JSON.parse(event.body ?? '{}');
      const job_id = randomUUID();
      const ttl = Math.floor(Date.now()/1000) + 7*24*3600;
      const now = Date.now();
      await ddb.send(new PutItemCommand({
        TableName: process.env.JOBS_TABLE,
        Item: {
          job_id: { S: job_id },
          source_file_key: { S: \`uploads/\${file_id}\` },
          output_file_key: { S: '' },
          target_size_mb: { N: String(target_size_mb ?? 25) },
          actual_output_size_mb: { N: '0' },
          status: { S: 'queued' },
          progress_pct: { N: '0' },
          estimated_time_remaining_sec: { N: '0' },
          output_url: { S: '' },
          codec: { S: codec ?? 'h264' },
          error_message: { S: '' },
          created_at: { N: String(now) },
          completed_at: { N: '0' },
          ttl: { N: String(ttl) },
        },
      }));
      const subnet = process.env.VPC_SUBNET_1;
      const subnet2 = process.env.VPC_SUBNET_2;
      const sg = process.env.VPC_SG;
      const taskArn = await ecs.send(new RunTaskCommand({
        cluster: process.env.WORKER_CLUSTER,
        taskDefinition: process.env.WORKER_TASK_DEFINITION,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'ENABLED',
            subnets: [subnet, subnet2].filter(Boolean),
            securityGroups: sg ? [sg] : undefined,
          },
        },
        overrides: {
          containerOverrides: [{
            name: 'ffmpeg',
            environment: [
              { name: 'JOB_ID', value: job_id },
              { name: 'SOURCE_KEY', value: \`uploads/\${file_id}\` },
              { name: 'TARGET_SIZE_MB', value: String(target_size_mb ?? 25) },
              { name: 'CODEC', value: codec ?? 'h264' },
              { name: 'MAX_RESOLUTION', value: max_resolution ?? '1080p' },
              { name: 'AUDIO_BITRATE_KBPS', value: String(audio_bitrate_kbps ?? 128) },
            ],
          }],
        },
      }));
      return json(200, { job_id, status: 'queued', task_arn: taskArn.tasks?.[0]?.taskArn ?? null });
    }

    const jobMatch = path.match(/^\\/api\\/jobs\\/([0-9a-f-]+)(?:\\/download)?$/);
    if (jobMatch) {
      const jobId = jobMatch[1];
      const out = await ddb.send(new GetItemCommand({ TableName: process.env.JOBS_TABLE, Key: { job_id: { S: jobId } } }));
      if (!out.Item) return json(404, { error: { code: 'not_found', message: 'Job not found' } });
      const job = {
        job_id: out.Item.job_id.S,
        source_file_key: out.Item.source_file_key.S,
        output_file_key: out.Item.output_file_key?.S || null,
        target_size_mb: Number(out.Item.target_size_mb.N),
        actual_output_size_mb: Number(out.Item.actual_output_size_mb.N) || null,
        status: out.Item.status.S,
        progress_pct: Number(out.Item.progress_pct.N),
        estimated_time_remaining_sec: Number(out.Item.estimated_time_remaining_sec.N) || null,
        output_url: out.Item.output_url?.S || null,
        codec: out.Item.codec.S,
        error_message: out.Item.error_message?.S || null,
        created_at: Number(out.Item.created_at.N),
        completed_at: Number(out.Item.completed_at.N) || null,
      };
      if (path.endsWith('/download') && method === 'GET') {
        if (!job.output_file_key) return json(409, { error: { code: 'not_ready', message: 'Output not ready' } });
        const cmd = new GetObjectCommand({ Bucket: process.env.OUTPUTS_BUCKET, Key: job.output_file_key });
        const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
        return json(200, { url });
      }
      if (method === 'DELETE') {
        await ddb.send(new UpdateItemCommand({
          TableName: process.env.JOBS_TABLE,
          Key: { job_id: { S: jobId } },
          UpdateExpression: 'SET #s = :s',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':s': { S: 'failed' } },
        }));
        return json(204, {});
      }
      return json(200, job);
    }

    return json(404, { error: { code: 'not_found', message: 'Route not found' } });
  } catch (err) {
    console.error('handler error', err);
    return json(500, { error: { code: 'internal', message: err.message } });
  }
};
`),
      timeout: Duration.seconds(30),
      memorySize: 512,
      role: apiRole,
      environment: {
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        OUTPUTS_BUCKET: outputsBucket.bucketName,
        JOBS_TABLE: jobsTable.tableName,
        WORKER_CLUSTER: cluster.clusterName,
        WORKER_TASK_DEFINITION: taskDefinition.family,
        PASSWORD_HASH_SECRET: passwordHashSecret.secretName,
        TOTP_SECRET_SECRET: totpSecret.secretName,
        JWT_SIGNING_KEY_SECRET: jwtSigningKey.secretName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    // ─── API Gateway HTTP API ────────────────────────────────
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'https://kompressa.pages.dev';
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'kompressa-api',
      description: 'Kompressa public API',
      corsPreflight: {
        allowOrigins: [frontendOrigin],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type', 'cookie'],
        allowCredentials: true,
      },
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
