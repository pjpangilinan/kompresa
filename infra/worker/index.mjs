import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, statSync, createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const exec = promisify(execFile);
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const JOB_ID = process.env.JOB_ID;
const SOURCE_KEY = process.env.SOURCE_KEY;
const TARGET_SIZE_MB = Number(process.env.TARGET_SIZE_MB ?? 25);
const CODEC = process.env.CODEC ?? 'h264';
const MAX_RESOLUTION = process.env.MAX_RESOLUTION ?? '1080p';
const AUDIO_BITRATE_KBPS = Number(process.env.AUDIO_BITRATE_KBPS ?? 128);

const RES_TO_HEIGHT = { '480p': 480, '720p': 720, '1080p': 1080, '2160p': 2160 };
const maxHeight = RES_TO_HEIGHT[MAX_RESOLUTION] ?? 1080;

async function setStatus(status, extra = {}) {
  const names = { s: 'status', p: 'progress_pct', e: 'error_message', o: 'output_file_key', a: 'actual_output_size_mb', c: 'completed_at' };
  const values = {
    ':s': { S: status },
    ':p': { N: String(extra.progress_pct ?? 0) },
    ':e': { S: extra.error_message ?? '' },
    ':o': { S: extra.output_file_key ?? '' },
    ':a': { N: String(extra.actual_output_size_mb ?? 0) },
    ':c': { N: String(extra.completed_at ?? 0) },
  };
  await ddb.send(new UpdateItemCommand({
    TableName: process.env.JOBS_TABLE,
    Key: { job_id: { S: JOB_ID } },
    UpdateExpression: 'SET #s = :s, progress_pct = :p, error_message = :e, output_file_key = :o, actual_output_size_mb = :a, completed_at = :c',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: values,
  }));
}

async function downloadSource(workDir) {
  const inPath = join(workDir, 'input');
  const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.UPLOADS_BUCKET, Key: SOURCE_KEY }));
  await new Promise((resolve, reject) => {
    const out = createWriteStream(inPath);
    out.on('error', reject);
    out.on('finish', resolve);
    obj.Body.pipe(out);
    obj.Body.on('error', reject);
  });
  return inPath;
}

async function probeDuration(inputPath) {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', inputPath]);
    return parseFloat(stdout.trim());
  } catch {
    return 0;
  }
}

async function encode(inputPath, outputPath) {
  const duration = await probeDuration(inputPath);
  const safetyMargin = 0.97;
  const audioKbps = Math.max(64, Math.min(192, AUDIO_BITRATE_KBPS));
  const totalKbps = (TARGET_SIZE_MB * 8192) / Math.max(1, duration);
  const videoKbps = Math.max(100, Math.floor((totalKbps - audioKbps) * safetyMargin));

  const codecArgs = CODEC === 'h265'
    ? ['-c:v', 'libx265', '-preset', 'medium']
    : CODEC === 'av1'
    ? ['-c:v', 'libaom-av1', '-cpu-used', '4']
    : ['-c:v', 'libx264', '-preset', 'medium'];

  const filter = `scale='min(iw,trunc(iw*(${maxHeight}/ih)*2)/2)':'min(ih,${maxHeight})':force_original_aspect_ratio=decrease`;

  await setStatus('probing', { progress_pct: 5 });
  await setStatus('processing', { progress_pct: 10 });

  const passLog = '/tmp/ffmpeg2pass';
  const pass1 = [
    '-y', '-i', inputPath,
    ...codecArgs,
    '-b:v', `${videoKbps}k`,
    '-vf', filter,
    '-an', '-sn',
    '-pass', '1',
    '-passlogfile', passLog,
    '-f', 'null',
    '/dev/null',
  ];
  const pass2 = [
    '-y', '-i', inputPath,
    ...codecArgs,
    '-b:v', `${videoKbps}k`,
    '-vf', filter,
    '-pass', '2',
    '-passlogfile', passLog,
    '-c:a', 'aac', '-b:a', `${audioKbps}k`,
    '-movflags', '+faststart',
    outputPath,
  ];
  await exec('ffmpeg', pass1, { maxBuffer: 64 * 1024 * 1024 });
  await setStatus('processing', { progress_pct: 60 });
  await exec('ffmpeg', pass2, { maxBuffer: 64 * 1024 * 1024 });
  await setStatus('verifying', { progress_pct: 96 });
  const size = statSync(outputPath).size;
  return size;
}

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), 'kompressa-'));
  try {
    const input = await downloadSource(workDir);
    const output = join(workDir, 'output.mp4');
    const size = await encode(input, output);
    const outKey = `outputs/${JOB_ID}.mp4`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.OUTPUTS_BUCKET,
      Key: outKey,
      Body: createReadStream(output),
      ContentType: 'video/mp4',
    }));
    await setStatus('completed', {
      progress_pct: 100,
      output_file_key: outKey,
      actual_output_size_mb: Math.round((size / 1024 / 1024) * 10) / 10,
      completed_at: Date.now(),
    });
    process.exit(0);
  } catch (err) {
    console.error('worker error', err);
    await setStatus('failed', { error_message: err?.message ?? String(err) });
    process.exit(1);
  }
}

main();
