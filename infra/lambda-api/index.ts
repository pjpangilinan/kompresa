import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';

const ecs = new ECSClient({});
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const sm = new SecretsManagerClient({});

interface JobItem {
  job_id: string;
  source_file_key: string;
  output_file_key: string | null;
  target_size_mb: number;
  actual_output_size_mb: number | null;
  status: string;
  progress_pct: number;
  estimated_time_remaining_sec: number | null;
  output_url: string | null;
  codec: string;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type,cookie',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

const secretsCache: Record<string, string> = {};

async function loadSecret(name: string): Promise<string> {
  if (secretsCache[name]) return secretsCache[name];
  const out = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  secretsCache[name] = out.SecretString ?? '';
  return secretsCache[name];
}

function json(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

function parseBody(event: any): any {
  try {
    return JSON.parse(event.body ?? '{}');
  } catch {
    return {};
  }
}

function getCookie(event: any, name: string): string | null {
  const cookie = event.headers?.cookie ?? event.headers?.Cookie ?? '';
  const m = cookie.match(new RegExp(`${name}=([^;]+)`));
  return m ? m[1] : null;
}

function fromDdb(item: Record<string, any>): JobItem {
  return {
    job_id: item.job_id.S,
    source_file_key: item.source_file_key.S,
    output_file_key: item.output_file_key?.S || null,
    target_size_mb: Number(item.target_size_mb.N),
    actual_output_size_mb: item.actual_output_size_mb?.N ? Number(item.actual_output_size_mb.N) : null,
    status: item.status.S,
    progress_pct: Number(item.progress_pct.N),
    estimated_time_remaining_sec: item.estimated_time_remaining_sec?.N ? Number(item.estimated_time_remaining_sec.N) : null,
    output_url: item.output_url?.S || null,
    codec: item.codec?.S || 'h264',
    error_message: item.error_message?.S || null,
    created_at: Number(item.created_at.N),
    completed_at: item.completed_at?.N ? Number(item.completed_at.N) : null,
  };
}

async function verifySession(event: any): Promise<any | null> {
  const token = getCookie(event, 'session');
  if (!token) return null;
  try {
    const key = await loadSecret(process.env.JWT_SIGNING_KEY_SECRET!);
    return jwt.verify(token, key);
  } catch {
    return null;
  }
}

export async function handler(event: any): Promise<any> {
  const path = event.rawPath ?? event.path ?? '/';
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';

  if (method === 'OPTIONS') return json(200, {});

  try {
    if (path === '/api/login' && method === 'POST') {
      const { password, totp } = parseBody(event);
      const [hash, tSecret, key] = await Promise.all([
        loadSecret(process.env.PASSWORD_HASH_SECRET!),
        loadSecret(process.env.TOTP_SECRET_SECRET!),
        loadSecret(process.env.JWT_SIGNING_KEY_SECRET!),
      ]);

      const passwordOk = await bcrypt.compare(password ?? '', hash);
      const totpOk = speakeasy.totp.verify({
        secret: tSecret,
        encoding: 'base32',
        token: String(totp ?? ''),
        window: 1,
      });

      if (!passwordOk || !totpOk) {
        return json(401, { error: { code: 'invalid_credentials', message: 'Invalid credentials' } });
      }

      const token = jwt.sign({ sub: 'admin', iat: Math.floor(Date.now() / 1000) }, key, { expiresIn: '12h' });
      const expiresAt = Date.now() + 12 * 3600 * 1000;

      return {
        statusCode: 200,
        headers: {
          'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=43200`,
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
        body: JSON.stringify({ expires_at: expiresAt }),
      };
    }

    const session = await verifySession(event);
    if (!session && path !== '/api/session') {
      return json(401, { error: { code: 'unauthorized', message: 'Auth required' } });
    }

    if (path === '/api/session' && method === 'GET') {
      return json(200, { authenticated: !!session });
    }

    if (path === '/api/logout' && method === 'POST') {
      return {
        statusCode: 204,
        headers: {
          'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0',
          ...CORS_HEADERS,
        },
      };
    }

    if (path === '/api/uploads' && method === 'POST') {
      const fileId = randomUUID();
      const cmd = new PutObjectCommand({
        Bucket: process.env.UPLOADS_BUCKET!,
        Key: `uploads/${fileId}`,
      });
      const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
      return json(200, {
        upload_url: uploadUrl,
        file_id: fileId,
        expires_at: Date.now() + 900 * 1000,
      });
    }

    if (path === '/api/compress' && method === 'POST') {
      const { file_id, target_size_mb, codec, max_resolution, audio_bitrate_kbps } = parseBody(event);
      const jobId = randomUUID();
      const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      const now = Date.now();

      await ddb.send(new PutItemCommand({
        TableName: process.env.JOBS_TABLE!,
        Item: {
          job_id: { S: jobId },
          source_file_key: { S: `uploads/${file_id}` },
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

      const subnets = [
        process.env.VPC_SUBNET_1,
        process.env.VPC_SUBNET_2,
      ].filter(Boolean) as string[];

      const sg = process.env.VPC_SG;

      const runResult = await ecs.send(new RunTaskCommand({
        cluster: process.env.WORKER_CLUSTER!,
        taskDefinition: process.env.WORKER_TASK_DEFINITION!,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'ENABLED',
            subnets: subnets.length > 0 ? subnets : undefined,
            securityGroups: sg ? [sg] : undefined,
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'ffmpeg',
              environment: [
                { name: 'JOB_ID', value: jobId },
                { name: 'SOURCE_KEY', value: `uploads/${file_id}` },
                { name: 'TARGET_SIZE_MB', value: String(target_size_mb ?? 25) },
                { name: 'CODEC', value: codec ?? 'h264' },
                { name: 'MAX_RESOLUTION', value: max_resolution ?? '1080p' },
                { name: 'AUDIO_BITRATE_KBPS', value: String(audio_bitrate_kbps ?? 128) },
              ],
            },
          ],
        },
      }));

      return json(200, {
        job_id: jobId,
        status: 'queued',
        task_arn: runResult.tasks?.[0]?.taskArn ?? null,
      });
    }

    const jobMatch = path.match(/^\/api\/jobs\/([0-9a-f-]+)(?:\/download)?$/);
    if (jobMatch) {
      const jobId = jobMatch[1];

      if (path.endsWith('/download') && method !== 'GET') {
        return json(405, { error: { code: 'method_not_allowed', message: 'Only GET allowed for download' } });
      }

      const out = await ddb.send(new GetItemCommand({
        TableName: process.env.JOBS_TABLE!,
        Key: { job_id: { S: jobId } },
      }));

      if (!out.Item) {
        return json(404, { error: { code: 'not_found', message: 'Job not found' } });
      }

      const job = fromDdb(out.Item);

      if (path.endsWith('/download')) {
        if (!job.output_file_key) {
          return json(409, { error: { code: 'not_ready', message: 'Output not ready' } });
        }
        const cmd = new GetObjectCommand({
          Bucket: process.env.OUTPUTS_BUCKET!,
          Key: job.output_file_key,
        });
        const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
        return json(200, { url });
      }

      if (method === 'DELETE') {
        await ddb.send(new UpdateItemCommand({
          TableName: process.env.JOBS_TABLE!,
          Key: { job_id: { S: jobId } },
          UpdateExpression: 'SET #s = :s, error_message = :e',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':s': { S: 'cancelled' },
            ':e': { S: 'Cancelled by user' },
          },
        }));
        return json(204, {});
      }

      return json(200, job);
    }

    // Not a recognised route
    if (method === 'GET' && path === '/') {
      return json(200, { service: 'kompressa-api', version: '1.0' });
    }

    return json(404, { error: { code: 'not_found', message: 'Route not found' } });
  } catch (err: any) {
    console.error('Handler error:', err);
    return json(500, {
      error: {
        code: 'internal_error',
        message: err?.message ?? 'Unknown error',
      },
    });
  }
}
