# Deployment Guide - TalentOS by Bloque

This guide covers deploying the full stack to production using:
- **Frontend**: Vercel
- **Backend API**: Railway
- **Database**: Neon (PostgreSQL)
- **Cache/Queue**: Upstash (Redis)
- **Storage**: Cloudflare R2 or AWS S3

## Prerequisites

1. GitHub account with this repository pushed
2. Accounts on: [Vercel](https://vercel.com), [Railway](https://railway.app), [Neon](https://neon.tech), [Upstash](https://upstash.com)
3. Optional: OpenAI API key for AI features (stub mode works without it)

---

## Step 1: Database (Neon PostgreSQL)

1. Go to [Neon Console](https://console.neon.tech)
2. Create new project: `talentos-production`
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb`)
4. Save this as `DATABASE_URL`

---

## Step 2: Redis (Upstash)

1. Go to [Upstash Console](https://console.upstash.com)
2. Create new Redis database: `talentos-redis`
3. Select region closest to your users
4. Copy the Redis URL (looks like `rediss://default:xxx@xxx.upstash.io:6379`)
5. Save this as `REDIS_URL`

---

## Step 3: Storage (Cloudflare R2)

### Option A: Cloudflare R2 (Recommended - cheaper)
1. Go to Cloudflare Dashboard > R2
2. Create bucket: `talentos-uploads`
3. Create API token with R2 read/write permissions
4. Save: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`

### Option B: AWS S3
1. Create S3 bucket: `talentos-uploads`
2. Create IAM user with S3 permissions
3. Save: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

---

## Step 4: Backend API (Railway)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" > "Deploy from GitHub repo"
3. Select this repository
4. Configure:
   - **Root Directory**: `apps/api`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. Add environment variables in Railway:

```env
# Database (from Neon)
DATABASE_URL=postgresql://...

# Redis (from Upstash)
REDIS_URL=rediss://...

# Storage (R2 or S3)
MINIO_ENDPOINT=xxx.r2.cloudflarestorage.com
MINIO_ACCESS_KEY=your-r2-access-key
MINIO_SECRET_KEY=your-r2-secret-key
MINIO_BUCKET=talentos-uploads
MINIO_USE_SSL=true

# Security (GENERATE NEW ONES!)
JWT_SECRET_KEY=generate-a-64-char-random-string-here

# LLM (optional - works without it)
LLM_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o-mini

# CORS (add your Vercel domain)
API_CORS_ORIGINS=https://your-app.vercel.app,https://talentos.yourdomain.com

# Production settings
API_DEBUG=false
LOG_LEVEL=INFO
```

6. Deploy and copy the Railway URL (e.g., `https://talentos-api-production.up.railway.app`)

### Run Migrations

In Railway, open the shell and run:
```bash
alembic upgrade head
python -m scripts.seed
```

---

## Step 5: Worker (Railway - Optional)

For background jobs, create a second Railway service:

1. In same project, add new service from same repo
2. Configure:
   - **Root Directory**: `apps/api`
   - **Start Command**: `rq worker --url $REDIS_URL high default low`
3. Add same environment variables as API

---

## Step 6: Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project" > Import from GitHub
3. Select this repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`

5. Add environment variables:

```env
NEXT_PUBLIC_API_URL=https://your-railway-api-url.up.railway.app
```

6. Deploy!

---

## Step 7: Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Project Settings > Domains
2. Add your domain: `app.yourdomain.com`
3. Update DNS records as shown

### Railway (API)
1. Go to Service Settings > Networking
2. Add custom domain: `api.yourdomain.com`
3. Update DNS records as shown

---

## Environment Variables Summary

### Backend (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection | `postgresql://user:pass@host/db` |
| `REDIS_URL` | Upstash Redis connection | `rediss://default:xxx@host:6379` |
| `JWT_SECRET_KEY` | 64-char random string | `openssl rand -hex 32` |
| `MINIO_ENDPOINT` | S3-compatible endpoint | `xxx.r2.cloudflarestorage.com` |
| `MINIO_ACCESS_KEY` | Storage access key | - |
| `MINIO_SECRET_KEY` | Storage secret key | - |
| `MINIO_BUCKET` | Bucket name | `talentos-uploads` |
| `MINIO_USE_SSL` | Use HTTPS | `true` |
| `LLM_API_KEY` | OpenAI API key (optional) | `sk-...` |
| `API_CORS_ORIGINS` | Allowed origins | `https://app.yourdomain.com` |
| `API_DEBUG` | Debug mode | `false` |

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.yourdomain.com` |

---

## Generate Secure JWT Secret

Run this command to generate a secure secret:

```bash
openssl rand -hex 32
```

Or use Python:
```python
import secrets
print(secrets.token_hex(32))
```

---

## Post-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Seed data created (test users)
- [ ] API health check: `GET /health`
- [ ] Login works with test credentials
- [ ] File upload works
- [ ] AI interview works (with or without OpenAI key)

---

## Monitoring

### Railway
- View logs in Railway dashboard
- Set up alerts for errors

### Vercel
- View deployment logs
- Enable Analytics (optional)

### Upstash
- Monitor Redis usage
- Set up alerts for queue depth

---

## Costs Estimate (Monthly)

| Service | Free Tier | Paid Estimate |
|---------|-----------|---------------|
| Vercel | 100GB bandwidth | $20/mo Pro |
| Railway | $5 credit | ~$10-20/mo |
| Neon | 0.5GB storage | ~$19/mo |
| Upstash | 10K commands/day | ~$10/mo |
| R2 | 10GB storage | ~$5/mo |
| **Total** | ~Free to start | ~$50-70/mo |

---

## Troubleshooting

### CORS Errors
- Ensure `API_CORS_ORIGINS` includes your Vercel domain
- Check both `http://` and `https://` versions

### Database Connection Errors
- Verify `DATABASE_URL` format
- Check Neon dashboard for connection limits

### File Upload Failures
- Verify storage credentials
- Check bucket permissions
- Ensure `MINIO_USE_SSL=true` for production

### AI Features Not Working
- Without `LLM_API_KEY`, stub mode is used (deterministic responses)
- With key, check OpenAI API quota
