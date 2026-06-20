# Free-Tier Deployment Guide

This stack runs on **zero monthly cost** across:

| Component | Service | Free tier |
|-----------|---------|-----------|
| Web dashboard (`apps/web`) | Vercel | Unlimited static + 100 GB bandwidth |
| Gate kiosk (`apps/kiosk`) | Vercel (second project) | same |
| API (`apps/api`) | Render web service | 750 hr/month, sleeps after 15 min idle |
| Postgres | Neon | 0.5 GB storage, 1 project free |
| Redis | Upstash | 10 K commands/day free |
| Mobile (`apps/mobile`) | Expo Go (dev) / EAS (prod build) | Expo Go is free for dev |
| Source / CI | GitHub | unlimited public + private repos |

> **Cold-start caveat**: Render free tier sleeps the API after 15 min inactivity. First request after a sleep takes ~30 s. Either accept it, or use UptimeRobot (free) to ping `/health` every 5 min.

---

## 0. Prerequisites

- GitHub account
- Vercel, Render, Neon, Upstash accounts (all free, signup with GitHub)
- Node 20+, npm 10+ installed locally

---

## 1. Push to GitHub

```powershell
# Already done: git init, .gitignore, branch=main
cd C:\Users\JSK\Desktop\VMS

git add .
git commit -m "Initial commit: VMS monorepo"

# Create a new empty repo on github.com (no README/license)
# Then:
git remote add origin https://github.com/<your-username>/vms.git
git push -u origin main
```

---

## 2. Set up Neon (Postgres)

1. Sign in at https://neon.tech → **Create project** → region close to you.
2. From the dashboard copy the **Pooled connection** string. Looks like:
   `postgresql://USER:PASS@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. Locally, set `DATABASE_URL` in `.env.local` and push the schema:
   ```powershell
   cd packages\database
   npx prisma generate
   npx prisma db push
   ```
   This creates all tables in Neon.

---

## 3. Set up Upstash (Redis)

1. Sign in at https://upstash.com → **Create Database** → Global / closest region.
2. Copy the **`rediss://` URL** (TLS variant).
3. You'll paste it into Render in step 5.

---

## 4. Deploy `apps/web` on Vercel

1. https://vercel.com/new → import the GitHub repo.
2. **Root directory**: `apps/web`
3. Framework: Next.js (auto-detected).
4. Build/install commands are already in `apps/web/vercel.json`.
5. **Environment variables** (Production):
   - `NEXT_PUBLIC_API_URL` = `https://<your-render-service>.onrender.com` (you'll get this URL in step 5; can update later)
6. Deploy.

Repeat with **Root directory = `apps/kiosk`** to deploy the kiosk as a second Vercel project.

---

## 5. Deploy `apps/api` on Render

### Easy path: use the included Blueprint

1. https://render.com/blueprints → **New Blueprint Instance**.
2. Select your GitHub repo → Render reads `render.yaml`.
3. Render creates a free web service named `vms-api`.
4. In the service's **Environment** tab, paste real values for the `sync: false` keys:
   - `DATABASE_URL` → Neon pooled URL
   - `REDIS_URL` → Upstash rediss:// URL
   - `CORS_ORIGIN` → `https://<your-web-project>.vercel.app`
5. `JWT_SECRET` is auto-generated.
6. Deploy. First build takes ~3–5 min.

### Verify

```
curl https://<your-render-service>.onrender.com/health
# → {"status":"ok"}
```

Then update the Vercel web project's `NEXT_PUBLIC_API_URL` to this Render URL and redeploy.

---

## 6. Mobile app (`apps/mobile`)

The mobile app uses Expo. For free development:

```powershell
cd apps\mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. To talk to the deployed API, edit `apps/mobile/app.json` and set `extra.apiUrl` to your Render URL, then restart.

Production builds (`.apk` / `.ipa`) need an EAS account — the free tier covers 30 builds/month.

---

## 7. (Optional) Keep API warm on free Render tier

Free Render sleeps after 15 min. To keep the API responsive:

- https://uptimerobot.com → free monitor → HTTP(s) → URL = `https://<your-api>.onrender.com/health` → interval 5 min.
- This burns a few seconds of Render's 750 free hours; you'll still be well under the cap.

---

## 8. Daily workflow

```powershell
# Make changes locally
npm run dev   # runs web + kiosk + api in watch mode (turbo)

# Verify production builds before pushing
npm run build

# Commit + push -> Vercel + Render auto-deploy
git add .
git commit -m "..."
git push
```

---

## Quick troubleshooting

| Symptom | Fix |
|---------|-----|
| Vercel build "Cannot find module @vms/database" | Ensure root dir is `apps/web` (or `apps/kiosk`) and `vercel.json` is committed |
| Render build "PrismaClient not found" | The `buildCommand` in `render.yaml` must run `prisma generate` before `nest build` |
| 502 from API on first request after idle | Cold start — wait 30 s, or set up UptimeRobot (step 7) |
| `CORS error` in browser | Set `CORS_ORIGIN` in Render to the exact Vercel URL (including `https://`) |
| Neon "too many connections" | Use the **pooled** connection string, not the direct one |
