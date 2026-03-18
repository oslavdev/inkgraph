# Inkgraph — Project Context

## What is it

A node-based visual dialogue editor for visual novels and RPGs. Users build branching conversations (nodes, choices, conditions, variables, characters) on an infinite canvas. Runs in the browser, saves to a database, fully authenticated.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Router 7 (framework mode, SSR, `ssr: true`) |
| Bundler | Vite 6 |
| Database | Turso (SQLite via `@libsql/client`) |
| ORM | Drizzle ORM — timestamps stored as `{ mode: "number" }` (Unix seconds integers, never `Date` objects) |
| Auth | better-auth — email+password, sessions in DB, HTTP-only cookie |
| Email | Resend — welcome, verification, password reset |
| Runtime | Node.js 20 + `@react-router/serve` |
| Deployment | Docker → Railway |
| Linting | Biome 1.9 |
| Testing | Vitest + jsdom |
| CI | GitHub Actions (ci.yml + release.yml) |
| Releases | semantic-release (conventional commits) |
| Git hooks | Husky — pre-commit runs lint-staged (Biome), commit-msg runs commitlint |

---

## Folder structure

```
inkgraph/
├── app/
│   ├── __tests__/
│   │   ├── setup.ts               # vitest global setup, localStorage mock, RR mocks
│   │   ├── uid.test.ts
│   │   ├── tree.test.ts
│   │   └── projects.server.test.ts
│   ├── components/
│   │   ├── editor-core.jsx        # ALL editor logic — useTree hook, Canvas, panels,
│   │   │                          #   modals, PANELS, HOTKEYS, C theme constants
│   │   ├── editor-core.d.ts       # Full TypeScript declarations for editor-core.jsx
│   │   ├── NodePreview.jsx        # Static SVG diagram used on landing page
│   │   └── NodePreview.d.ts
│   ├── routes/
│   │   ├── home.tsx               # Landing page — /
│   │   ├── login.tsx              # Login + Register + Forgot password — /login
│   │   ├── reset-password.tsx     # Password reset from email link — /reset-password
│   │   ├── projects.tsx           # Project dashboard — /projects
│   │   ├── editor.tsx             # Editor — /editor and /editor/:projectId
│   │   ├── account.tsx            # Profile, change password, delete account — /account
│   │   └── api.auth.$.ts          # better-auth catch-all handler — /api/auth/*
│   ├── server/
│   │   ├── schema.server.ts       # Drizzle schema
│   │   ├── db.server.ts           # Turso + Drizzle singleton
│   │   ├── auth.server.ts         # better-auth config + welcome email hook
│   │   ├── session.server.ts      # getSession(), requireUser()
│   │   ├── projects.server.ts     # Project CRUD
│   │   ├── email.server.ts        # Resend — welcome, verification, reset emails
│   │   └── migrate.server.ts      # Run Drizzle migrations (CLI script)
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── root.tsx                   # HTML shell, global styles, error boundary
│   └── routes.ts                  # Route config
├── drizzle/                       # Auto-generated migration files
├── public/
├── .github/workflows/
│   ├── ci.yml                     # lint + typecheck + test on PR/push
│   └── release.yml                # semantic-release on push to main
├── .husky/
│   ├── pre-commit                 # runs lint-staged
│   └── commit-msg                 # runs commitlint
├── .env.example
├── biome.json
├── Dockerfile
├── drizzle.config.ts
├── package.json
├── react-router.config.ts
├── tsconfig.json
├── tsconfig.test.json
├── vite.config.ts
├── vitest.config.ts
├── .commitlintrc.json
└── .releaserc.json
```

---

## Database schema

```
user         — id, name, email, emailVerified, createdAt, updatedAt
session      — id, token, userId, expiresAt, ...
account      — id, userId, providerId, password (hashed by better-auth)
verification — id, identifier, value, expiresAt   (reset + verify tokens)

project      — id, userId, name, description, data (JSON text), lastOpenedAt,
               createdAt, updatedAt
               timestamps: { mode: "number" } = Unix seconds, use Math.floor(Date.now()/1000)
```

`project.data` is a JSON string containing:
```json
{
  "scenes": [{ "id": "...", "name": "Scene 1", "description": "" }],
  "nodesByScene": {
    "<sceneId>": {
      "root": "<nodeId>",
      "nodes": { "<nodeId>": { ...nodeShape } }
    }
  },
  "characters": [],
  "variables": []
}
```

`emptyProjectData()` in `projects.server.ts` generates a valid initial structure with a scene and root node using `crypto.randomUUID()` — never return empty `scenes: []` or `nodesByScene: {}` as that breaks `useTree`.

---

## Auth flow

- `POST /api/auth/sign-up/email` → creates user, sends **verification email** + **welcome email**, does NOT auto-sign-in (requires verification)
- `POST /api/auth/sign-in/email` → sets session cookie (HTTP-only, signed with `BETTER_AUTH_SECRET`)
- `POST /api/auth/sign-out` → deletes session row in DB. Must call with `credentials: 'include'`. Use `window.location.href = '/'` after (hard redirect, not React Router navigate) to ensure server sees the cleared cookie
- `POST /api/auth/forget-password` → sends reset email
- `POST /api/auth/reset-password` → validates token, sets new password
- `POST /api/auth/change-password` → requires current password
- `DELETE /api/auth/delete-user` → deletes account + all projects (cascade). Response may be 204 (empty body) — never call `.json()` unconditionally, check `res.ok` first then parse text safely

Session is read server-side via `getSession(request)` in `session.server.ts`. Protected routes use `requireUser(request)` which throws a redirect to `/login` if no session.

---

## Routing

| Path | Auth | Description |
|---|---|---|
| `/` | public | Landing page — CTAs change based on `isLoggedIn` from loader |
| `/login` | redirect if authed | Login / Register / Forgot / Verify-email views |
| `/reset-password?token=...` | public | Set new password |
| `/projects` | required | Project dashboard — create, rename, delete, open |
| `/editor` | required | Redirects to last opened project or creates a new one |
| `/editor/:projectId` | required | Editor with specific project loaded |
| `/account` | required | Profile, change password, delete account |
| `/api/auth/*` | — | better-auth handler |

---

## Editor architecture

The editor is split across two files:

**`editor-core.jsx`** — pure React, no server imports, exports everything the editor needs:
- `useTree()` — main state hook. Reads/writes to `localStorage` keys `vn2-scenes`, `vn2-nbs`, `vn2-chars`, `vn2-vars`. Returns full tree state + all mutations.
- `Canvas` — SVG infinite canvas with pan, drag, port connections (mouse + touch)
- `PANELS` — array of `{ id, label, icon }` for the sidebar rail
- `HOTKEYS` — array of `[key, description]`
- `C` — theme constants object
- All sidebar panels, modals, UI helpers

**`editor.tsx`** (route) — server + client:
- Loader: loads project by `params.projectId`, touches `lastOpenedAt`, redirects if not found. `/editor` (no param) → last opened or creates new.
- Action: `autosave` intent — saves project data to DB
- On mount: seeds `localStorage` with `project.data` keyed by `project.id` so switching projects clears stale canvas state. Calls `localStorage.removeItem('vn2-active-scene')` so `useTree` picks the first scene fresh.
- Auto-saves every 30 seconds via `setInterval` + `doSaveRef` pattern (avoids stale closure deps)
- Also saves on project name blur (`onBlur={doSave}`)
- Top bar: `← Projects` / editable project name / `✓ Saved` status / account button (purple gradient)
- No manual Save button

---

## Style preferences

Follow Biome config. Additional rules enforced across the codebase:

1. **Named functions** — `function doThing()` not `const doThing = () =>`
2. **No semicolons**
3. **Single quotes** in imports and strings — not double quotes, not backticks unless interpolating
4. **Template strings over concatenation** — `` `Hello ${name}` `` not `'Hello ' + name`
5. **`for...of` over `.forEach`** — Biome `noForEach` rule is active
6. **Relative imports only** — `'../server/session.server'` not `'~/server/session.server'`
7. **`type="button"` on every `<button>`** — never omit, even in JSX
8. **SVGs need `<title>` or `aria-hidden="true"`** — meaningful SVGs get `role="img"` + `aria-label` + `<title>` child; decorative icons get `aria-hidden="true"`
9. **`onClick` on non-button elements needs `onKeyDown`** — Biome `useKeyWithClickEvents` — add `onKeyDown={(e) => { if (e.key === 'Escape') ... }}` or similar

Biome config highlights:
- `semicolons: "asNeeded"` (none)
- `quoteStyle: "double"` for JSX attributes but `"single"` for JS strings (Biome handles this)
- `noVar`, `useConst`, `noForEach`, `useLiteralKeys`, `useTemplate` all active
- Test files exempt from `noConsoleLog` and `noExplicitAny`

---

## Environment variables

```env
APP_URL=http://localhost:5173
BETTER_AUTH_SECRET=<openssl rand -base64 32>
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_token
RESEND_API_KEY=re_...
EMAIL_FROM=Inkgraph <noreply@yourdomain.com>
```

Timestamps in DB are Unix seconds. Always use `Math.floor(Date.now() / 1000)` — never `new Date()` when writing to Drizzle + libsql.

---

## Key decisions / gotchas

- **libsql rejects `Date` objects** — all Drizzle columns that are timestamps use `{ mode: "number" }` and values are written as `Math.floor(Date.now() / 1000)`
- **Sign-out must hard-redirect** — `window.location.href = '/'` not `navigate('/')`, otherwise React Router skips the server loader and the session cookie appears valid
- **`emptyProjectData()` must include a root node** — returning `scenes: []` / `nodesByScene: {}` causes `useTree` to start with `rootId: null` and a blank canvas with no way to add nodes
- **localStorage seed keyed by `project.id`** — switching projects re-seeds and clears `vn2-active-scene` so `useTree` starts fresh
- **`.jsx` components need `.d.ts` declarations** — `editor-core.d.ts` and `NodePreview.d.ts` provide TypeScript types for the JSX files. `tsconfig.json` has `allowJs: true` and `"**/*.d.ts"` in `include`
- **React Router typegen must run before `tsc`** — `typecheck` script is `react-router typegen && tsc --noEmit`
- **`abortDelay` removed from `ServerRouter`** — not a valid prop in RR7; the `setTimeout(abort, ABORT_DELAY)` in `entry.server.tsx` handles it directly

---

## History of major changes in this session

1. **Initial build** — monolithic `DialogueEditor.jsx` with `LandingPage` + `Editor` in one file, localStorage only, no auth
2. **React Router 7 migration** — split into `app/routes/home.tsx` + `app/routes/editor.tsx`, added `entry.client/server.tsx`, `root.tsx`, `routes.ts`
3. **Auth + DB** — added better-auth, Turso/Drizzle, Resend. Schema: `user/session/account/verification/project`. Routes: `/login`, `/reset-password`, `/account`, `/api/auth/$`
4. **Inkgraph branding** — renamed from "VN Editor" throughout; rail logo `VN` → `IG`; page title updated
5. **Landing page** — hero with canvas blobs, node preview SVG diagram, annotated walkthrough section, desktop download section (disabled buttons, "soon" badge)
6. **Biome + tooling** — `biome.json`, `vitest.config.ts`, `tsconfig.test.json`, Husky hooks, lint-staged, commitlint, semantic-release, GitHub Actions CI + release
7. **Biome fixes (multiple rounds)** — `noParameterAssign`, `useSingleVarDeclarator`, `noForEach`, `useTemplate`, `useKeyWithClickEvents`, `noSvgWithoutTitle`, `noArrayIndexKey`, `noLabelWithoutControl`, `useButtonType`, `noExcessiveCognitiveComplexity` (extracted helpers), `useExhaustiveDependencies` (doSaveRef pattern), relative imports
8. **Project management** — `/projects` dashboard, `/editor/:projectId`, `emptyProjectData()` with real root node, localStorage seed keyed by project ID, schema adds `description` + `lastOpenedAt`
9. **UX fixes** — removed rail profile avatar (profile is `/account`), topbar name button purple gradient, `LocalStorageNotice` redesigned (guest-first), KoFi nudge after 2 nodes, sign-out hard-redirects, delete account handles 204 empty body
10. **Email** — HTML welcome email, verification email, password reset email all using Resend with dark-themed templates; `sendOnSignUp: true` in better-auth; welcome email sent via `hooks.after`
11. **Fix: libsql timestamp crash** — `{ mode: "timestamp" }` → `{ mode: "number" }`, all writes use `Math.floor(Date.now() / 1000)` via `now()` helper