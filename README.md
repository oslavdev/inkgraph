# Inkgraph

A node-based visual dialogue editor for visual novels and RPGs. Build branching conversations with characters, variables, and story flags — with full user accounts, cloud project sync, and password reset via email.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React Router 7 (framework mode, SSR) |
| Bundler | Vite 6 |
| Database | Turso (SQLite via libsql) |
| ORM | Drizzle ORM |
| Auth | better-auth |
| Email | Resend |
| Runtime | Node.js 20 + @react-router/serve |
| Deployment | Docker → Railway |

## Project structure

```
inkgraph/
├── app/
│   ├── components/
│   │   ├── editor-core.jsx      # All editor logic, hooks, panels, modals
│   │   └── NodePreview.jsx      # Landing page SVG diagram
│   ├── routes/
│   │   ├── home.tsx             # Landing page         /
│   │   ├── login.tsx            # Login + register + forgot password
│   │   ├── reset-password.tsx   # Password reset (from email link)
│   │   ├── account.tsx          # Profile + change password + delete
│   │   ├── editor.tsx           # Editor app (auth-guarded)
│   │   └── api.auth.$.ts        # better-auth catch-all handler
│   ├── server/
│   │   ├── auth.server.ts       # better-auth config
│   │   ├── db.server.ts         # Turso + Drizzle client singleton
│   │   ├── schema.server.ts     # DB schema: users, sessions, projects
│   │   ├── projects.server.ts   # Project CRUD operations
│   │   ├── session.server.ts    # requireUser() helper
│   │   ├── email.server.ts      # Resend email wrapper
│   │   └── migrate.server.ts    # Run Drizzle migrations
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── root.tsx
│   └── routes.ts
├── drizzle/                     # Auto-generated migration files
├── .env.example
├── Dockerfile
├── DEPLOYMENT.md
├── drizzle.config.ts
├── package.json
├── react-router.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Routes

| Path | Auth | Description |
|------|------|-------------|
| `/` | Public | Landing page |
| `/login` | Redirect if authed | Login / Register / Forgot password |
| `/reset-password` | Public (token) | Set new password from email link |
| `/account` | Required | Profile, change password, delete account |
| `/editor` | Required | Full dialogue editor with project save/load |
| `/api/auth/*` | — | better-auth API handler |

## Getting started

```bash
git clone https://github.com/your-org/inkgraph
cd inkgraph
yarn install
cp .env.example .env   # fill in all values
yarn run db:migrate
yarn run dev
# → http://localhost:5173
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway deployment instructions.

## Auth flows

| Flow | How |
|------|-----|
| Register | POST `/api/auth/sign-up/email` — name, email, password |
| Login | POST `/api/auth/sign-in/email` — email, password |
| Sign out | POST `/api/auth/sign-out` |
| Forgot password | POST `/api/auth/forget-password` → email sent via Resend |
| Reset password | POST `/api/auth/reset-password` — token from email link |
| Change password | POST `/api/auth/change-password` — current + new password |
| Delete account | DELETE `/api/auth/delete-user` |

All auth endpoints are handled by **better-auth** via the catch-all `api/auth/$` route.

## Project save / load

- Projects are stored in the `project` table in Turso, scoped to the authenticated user
- The editor's **Save** button (top bar) submits to the `action` in `editor.tsx`
- The project selector dropdown loads from `listProjects(user.id)` in the `loader`
- Auto-save runs every 30 seconds when a project ID is set
- On first load, `localStorage` data is still used until the user explicitly saves to the server

## Database schema

```
user         — id, name, email, emailVerified, createdAt
session      — id, token, userId, expiresAt
account      — id, userId, providerId, password (hashed by better-auth)
verification — id, identifier, value, expiresAt  (reset tokens)
project      — id, userId, name, data (JSON), createdAt, updatedAt
```

Migrations live in `drizzle/`. Generate new ones after schema changes:

```bash
yarn run db:generate   # creates migration SQL in drizzle/
yarn run db:migrate    # applies pending migrations
```
