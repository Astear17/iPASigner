# iOS SignTool — Deployment Guide

## Architecture Overview

```
Frontend (Vercel)  ──→  Backend (Render, Docker)  ──→  MongoDB Atlas
React + Tailwind        FastAPI + zsign                (optional, for signing jobs)
```

---

## 1. Prerequisites

- [Vercel account](https://vercel.com) (free tier works)
- [Render account](https://render.com) (free tier works, but **paid plan recommended** for zsign builds)
- [MongoDB Atlas](https://cloud.mongodb.com) cluster (only required for Sign IPA feature)
- Git repository with this code pushed

---

## 2. Backend — Deploy to Render

### Step 1: Create a new Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your Git repository
3. Set these settings:
   - **Name**: `ios-signtool-backend` (or any name)
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Context**: `./backend`

### Step 2: Set Environment Variables on Render

| Variable | Value | Required |
|---|---|---|
| `MONGO_URL` | Your MongoDB Atlas connection string | ✅ For Sign IPA |
| `DB_NAME` | `ios_signtool` | ✅ For Sign IPA |
| `PUBLIC_BASE_URL` | Your Render service URL (e.g. `https://ios-signtool-backend.onrender.com`) | ✅ For Sign IPA |
| `ZSIGN_PATH` | `/usr/local/bin/zsign` | ✅ For Sign IPA |
| `JOB_TTL_SECONDS` | `1800` | Optional |
| `MAX_FILE_SIZE_MB` | `500` | Optional |
| `ZSIGN_TIMEOUT` | `300` | Optional |
| `CLEANUP_INTERVAL` | `300` | Optional |
| `MAX_CONCURRENT_JOBS` | `5` | Optional |

> **Note:** Check Certificate and Change Password features do **NOT** require MongoDB. Only Sign IPA requires it.

### Step 3: First Deploy

1. Click **Create Web Service** — Render will build the Docker image (takes 5–10 minutes on first build since it compiles zsign from source)
2. Once deployed, note your service URL: `https://your-service-name.onrender.com`
3. Update `PUBLIC_BASE_URL` environment variable to this URL

### Step 4: Health Check

Visit `https://your-service-name.onrender.com/api/health` — you should see:
```json
{"status": "ok", "zsign_available": true, ...}
```

---

## 3. Frontend — Deploy to Vercel

### Step 1: Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **New Project**
2. Import your Git repository
3. Vercel should auto-detect the `vercel.json` config

### Step 2: Set Environment Variables on Vercel

| Variable | Value |
|---|---|
| `REACT_APP_BACKEND_URL` | Your Render backend URL (e.g. `https://ios-signtool-backend.onrender.com`) |

> ⚠️ Do NOT include a trailing slash in the URL.

### Step 3: Deploy Settings

These are already set in `vercel.json`:
```json
{
  "buildCommand": "cd frontend && yarn install && yarn build",
  "outputDirectory": "frontend/build",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Step 4: Deploy

Click **Deploy** — Vercel will build and deploy in ~2 minutes.

### Step 5: Test Routes

After deployment, verify all routes work:
- `https://your-app.vercel.app/` — Homepage
- `https://your-app.vercel.app/signipa` — Sign IPA
- `https://your-app.vercel.app/checkcert` — Check Certificate
- `https://your-app.vercel.app/certpass` — Change Password

---

## 4. MongoDB Atlas Setup (for Sign IPA)

1. Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a database user with read/write permissions
3. Whitelist `0.0.0.0/0` in Network Access (for Render)
4. Copy the connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>`
5. Paste it as the `MONGO_URL` environment variable in Render

---

## 5. Custom Domain (Optional)

### Vercel
1. Dashboard → Your Project → **Settings** → **Domains**
2. Add your domain (e.g. `signtool.yoursite.com`)

### Render
1. Dashboard → Your Service → **Settings** → **Custom Domain**

---

## 6. Smoke Tests After Deploy

Run these to verify everything works:

```bash
# Backend health
curl https://your-backend.onrender.com/api/health

# App library (Sign IPA list)
curl https://your-backend.onrender.com/api/apps

# Check cert (with test files)
curl -X POST https://your-backend.onrender.com/api/check-cert \
  -F "p12_file=@cert.p12" \
  -F "mobileprovision_file=@cert.mobileprovision" \
  -F "password=YourPassword"

# Change password
curl -X POST https://your-backend.onrender.com/api/change-cert-password \
  -F "p12_file=@cert.p12" \
  -F "mobileprovision_file=@cert.mobileprovision" \
  -F "old_password=OldPass" \
  -F "new_password=NewPass" \
  -o cert_bundle.zip
```

---

## 7. Known Limitations

- **Render Free Tier**: Service spins down after 15 minutes of inactivity. First request after spin-down may take 30–60 seconds.
- **zsign Build**: The Docker image builds zsign from source, which takes ~5 minutes on first deploy. Subsequent deploys use Docker layer caching.
- **Sign IPA without zsign**: The Check Certificate and Change Password features work without zsign. Only Sign IPA requires it.
- **File Size**: Default max IPA size is 500 MB. Render free tier has limited RAM — large files may cause OOM errors.

---

## 8. Environment Variables Reference

### Backend (`backend/.env.example`)
```env
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/
DB_NAME=ios_signtool
PUBLIC_BASE_URL=https://your-backend.onrender.com
ZSIGN_PATH=/usr/local/bin/zsign
JOB_TTL_SECONDS=1800
MAX_FILE_SIZE_MB=500
ZSIGN_TIMEOUT=300
CLEANUP_INTERVAL=300
MAX_CONCURRENT_JOBS=5
```

### Frontend (`frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
```

---

Built by [Astear17](https://github.com/Astear17)
