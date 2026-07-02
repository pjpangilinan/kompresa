# Kompressa Backend (AWS CDK)

AWS infrastructure for the video compression service. CDK v2, TypeScript.

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   React SPA  │ -> │ API Gateway HTTP │ -> │ Lambda (API) │
│  (GH Pages)  │    │      API         │    │   Node 22    │
└──────────────┘    └──────────────────┘    └──────┬───────┘
                                                  │
                                  ┌───────────────┼───────────────┐
                                  ▼               ▼               ▼
                            ┌─────────┐    ┌──────────┐    ┌──────────┐
                            │   S3    │    │ DynamoDB │    │ Fargate  │
                            │ uploads │    │   jobs   │    │  worker  │
                            │ outputs │    │  (TTL)   │    │ (ffmpeg) │
                            └─────────┘    └──────────┘    └──────────┘
```

## Resources

| Resource | Purpose |
|---|---|
| S3 `kompressa-uploads-*` | Source video uploads (lifecycle: 7 days) |
| S3 `kompressa-outputs-*` | Compressed outputs (lifecycle: 7 days) |
| DynamoDB `kompressa-jobs` | Job metadata (PK: `job_id`, TTL on `ttl`) |
| Secrets Manager | `password-hash`, `totp-secret`, `jwt-signing-key` |
| ECR `kompressa-worker` | Fargate worker image |
| ECS Cluster + Fargate Task | ffmpeg two-pass encode, on-demand RunTask |
| Lambda `kompressa-api` | All API routes (login, upload, compress, status, download) |
| API Gateway HTTP API | Public HTTPS endpoint, CORS-enabled |

## Cost (ap-southeast-1)

- **Idle**: ~$3-5/month (Secrets Manager ~$1.20, ECR storage pennies, CloudWatch logs pennies)
- **Per job**: ~$0.01 (Fargate 2vCPU/4GB × ~2min) + minor S3/Lambda
- **Free tier covers**: Lambda 1M req/month, S3 5GB storage, DynamoDB 25GB

## Prerequisites

```bash
# Install CDK + AWS CLI if not present
npm install -g aws-cdk
aws configure   # enter account ID, region, access keys
```

## Bootstrap (one-time, per account/region)

```bash
cdk bootstrap aws://<account-id>/ap-southeast-1
```

## Deploy

```bash
npm install
npm run cdk:deploy
```

Outputs (printed after deploy):
- `ApiUrl` — API Gateway endpoint, set as `VITE_API_ORIGIN` in web
- `UploadsBucketName` / `OutputsBucketName` / `JobsTableName`
- `WorkerRepoUri` — push worker image here
- `ClusterName` / `TaskDefinitionFamily`

## Build + push worker

```bash
# (after first deploy creates the ECR repo)
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <WorkerRepoUri-host>
cd worker
docker build -t kompressa-worker .
docker tag kompressa-worker:latest <WorkerRepoUri>:latest
docker push <WorkerRepoUri>:latest
```

## Wire the frontend

In `web/.env.production`:
```
VITE_API_MOCK=false
VITE_API_ORIGIN=https://<api-id>.execute-api.ap-southeast-1.amazonaws.com
```

## TOTP secret

The first deploy creates a random base32 TOTP secret. Get the value:
```bash
aws secretsmanager get-secret-value --secret-id kompressa/totp-secret --region ap-southeast-1
```
Scan the base32 string into Google Authenticator / Authy / 1Password. Same secret for all trusted users.

## Password setup

Generate bcrypt hash of your password:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
```
Set it:
```bash
aws secretsmanager put-secret-value --secret-id kompressa/password-hash --secret-string '<hash>' --region ap-southeast-1
```

## Destroy

```bash
npm run cdk:destroy
```
Wipes all infra. Data in S3 + DynamoDB goes with it (retention policy = DESTROY).
