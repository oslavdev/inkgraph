# Deploying Inkgraph to Railway

Complete guide: local setup → services → Railway deployment.

---

## Prerequisites

- [Railway](https://railway.app) account
- [Turso](https://turso.tech) account (free)
- [Resend](https://resend.com) account (free)
- Node.js 20+ locally
- Git repository on GitHub / GitLab

---

## 1. Set up Turso (database)

Turso is SQLite-at-the-edge. Free tier: 500 databases, 9 GB storage.

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Log in
turso auth login

# Create a database
turso db create inkgraph

# Get the connection URL
turso db show inkgraph --url
# → libsql://inkgraph-<org>.turso.io

# Create an auth token
turso db tokens create inkgraph
# → copy the token
```

---

## 2. Set up Resend (email)

1. Go to [resend.com](https://resend.com) and sign up
2. **API Keys** → **Create API Key** → copy it
3. **Domains** → **Add Domain** → verify your domain via DNS
   - For testing only you can use `onboarding@resend.dev` as `EMAIL_FROM` — it only delivers to your own Resend account email
4. Once verified set `EMAIL_FROM=Inkgraph <noreply@yourdomain.com>`

---

## 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in all values:

```env
APP_URL=https://your-app.up.railway.app
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
TURSO_DATABASE_URL=libsql://inkgraph-<org>.turso.io
TURSO_AUTH_TOKEN=<token from step 1>
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Inkgraph <noreply@yourdomain.com>
```

---

## 4. Local development

```bash
yarn 
yarn run db:migrate
yarn run dev
# → http://localhost:5173
```

---

## 5. Deploy to Railway

### GitHub (recommended)

1. Push your code to GitHub
2. Railway dashboard → **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Go to **Variables** tab and add all 6 env vars (see table below)
5. Railway detects the Dockerfile, builds, runs migrations, starts server
6. Settings → **Networking** → **Generate Domain** → copy the URL
7. Update `APP_URL` variable to that URL → Railway redeploys automatically

### Railway CLI

```bash
yarn install -g @railway/cli
railway login
railway init
railway up
```

---

## 6. Environment variables

| Variable | Description |
|----------|-------------|
| `APP_URL` | Full URL of your app — used in password reset email links |
| `BETTER_AUTH_SECRET` | Random secret ≥ 32 chars (`openssl rand -base64 32`) |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified sender address in Resend |

`PORT` and `HOST` are set automatically by Railway / the Dockerfile.

---

## 7. Database migrations

Migrations run automatically on every container start.

```bash
# After changing schema — generate new migration files
yarn run db:generate

# Apply migrations
yarn run db:migrate

# Browse data locally
yarn run db:studio
```

---

## 8. Troubleshooting

**`TURSO_DATABASE_URL is not set`** — check Railway Variables tab, names are case-sensitive.

**Password reset emails not arriving** — verify your domain in Resend dashboard; check Resend → Logs; check spam.

**App shows 401 on `/editor`** — expected, `/editor` requires authentication. Go to `/login` first.

**`localStorage` data not showing after login** — use **Save** to push your local project to the server; it will then be available on any device.

**Build fails** — run `yarn run build` locally first to catch any TypeScript errors before pushing.

---

## 9. Updating desktop app download links

When ready, find the disabled `DownloadBtn` in `app/routes/editor.tsx` and the download buttons in `app/routes/home.tsx`. Replace `disabled` with `onClick={() => window.open("YOUR_URL")}` and remove the "soon" badge.
