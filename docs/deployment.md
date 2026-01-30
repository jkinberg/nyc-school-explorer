# Deployment Guide

Deploy NYC School Explorer to **Google Cloud Run** with **GitHub Actions** CI/CD.

## Architecture

```
GitHub (push to main)
  |
GitHub Actions (build + containerize)
  |
Artifact Registry (store container image)
  |
Cloud Run (serve traffic)
  |
Anthropic API / Gemini API (external services)
```

## Database Strategy

The SQLite database is pre-seeded locally and committed to the repo. This avoids needing raw Excel files during build.

- **Database location**: `data/schools.db` (5.3MB, committed to repo)
- **WAL files**: `data/*.db-shm`, `data/*.db-wal` (gitignored)

### Updating the Database

When new DOE data is released:

```bash
# 1. Download new Excel files to ../data-samples/raw/
# 2. Re-run seed script locally
npx tsx scripts/seed-database.ts

# 3. Commit the updated database
git add data/schools.db
git commit -m "Update database with 2025-26 SQR data"
git push
```

---

## Prerequisites

1. Google Cloud project with billing enabled
2. `gcloud` CLI installed and authenticated
3. GitHub repository

---

## Google Cloud Setup

### 1. Set Project Variables

```bash
export PROJECT_ID="nyc-school-explorer"
export REGION="us-central1"
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create nyc-school-explorer \
  --repository-format=docker \
  --location=$REGION \
  --description="NYC School Explorer container images"
```

### 4. Create Secrets for API Keys

```bash
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

### 5. Create Service Account for GitHub Actions

```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create JSON key for GitHub Actions
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com
```

---

## GitHub Configuration

Add these secrets to your GitHub repository settings (Settings > Secrets and variables > Actions):

| Secret Name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_SA_KEY` | Contents of `github-actions-key.json` |
| `GCP_REGION` | `us-central1` (or your preferred region) |

---

## Local Docker Testing

Before deploying, test the container locally:

```bash
# Build container
docker build -t nyc-school-explorer .

# Run locally
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  nyc-school-explorer

# Test API
curl localhost:3000/api/schools?limit=1
```

---

## Deployment

Push to `main` branch to trigger automatic deployment:

```bash
git push origin main
```

GitHub Actions will:
1. Build the container (with pre-seeded database)
2. Push to Artifact Registry
3. Deploy to Cloud Run

---

## Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| `ANTHROPIC_API_KEY` | Secret Manager | Yes |
| `GEMINI_API_KEY` | Secret Manager | No (but recommended) |
| `NODE_ENV` | Set in deploy command | Yes (`production`) |
| `ENABLE_EVALUATION` | Set in deploy command | No (default `true`) |

---

## Verification

After deployment, verify:

1. **GitHub Actions**: Workflow completes without errors
2. **Cloud Run**: Service URL loads the home page
3. **Database works**: `/api/schools?limit=1` returns data
4. **Chat works**: `/explore` page sends/receives messages
5. **Evaluation**: Responses show confidence scores (if Gemini key configured)

---

## Cost Estimates

| Service | Estimate |
|---------|----------|
| Cloud Run | ~$5-20/month (depends on traffic, scales to zero) |
| Artifact Registry | ~$0.10/GB/month |
| Secret Manager | ~$0.03/secret/month |
| **Total** | ~$10-30/month for low-medium traffic |

---

## Troubleshooting

### Build fails with "standalone" directory not found

Ensure `next.config.ts` has `output: 'standalone'`:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
};
```

### Database not found at runtime

Ensure `data/schools.db` is committed (check `.gitignore` doesn't exclude it).

### Secrets not available

Verify the Cloud Run service account has `secretmanager.secretAccessor` role:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Future Improvements

1. **Persistent Database**: Mount Cloud Storage FUSE or use Cloud SQL
2. **Database Migrations**: Add migration system (Drizzle, Prisma, or raw SQL)
3. **Caching**: Add Redis (Memorystore) for query caching
4. **CDN**: Add Cloud CDN for static assets
5. **Monitoring**: Add Cloud Monitoring dashboards and alerts
6. **Staging Environment**: Add preview deployments for PRs
