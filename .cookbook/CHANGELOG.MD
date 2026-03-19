# Changelog

All notable changes to Inkgraph are documented here.

---

## [Unreleased] — Manual fixes applied in dev session

### Bug fixes

#### Auth — sign-out not working
**Root cause:** `cookieCache` was enabled in `auth.server.ts` with a 5-minute TTL. better-auth
embeds a signed session snapshot in the cookie itself, so even after the DB session row is deleted,
the server kept accepting the cached cookie for up to 5 minutes.
**Fix:** Removed `cookieCache`. Every request now validates against the database, making sign-out
take effect immediately.

#### Auth — sign-out and delete-account silently failing
**Root cause:** Both used raw `fetch()` calls. better-auth 1.5.5 can require specific internal
headers from its own client SDK; bare fetch calls were silently failing. The sign-out `finally`
block always redirected regardless of success.
**Fix:** Moved both to a server-side React Router `action` in `account.tsx` via `useFetcher`.
The action constructs `Request` objects and passes them to `auth.handler()` directly — same as
`api.auth.$.ts`. Both throw a server redirect with `Set-Cookie: Max-Age=0` to expire the cookie.

#### Auth — delete-account wrong HTTP method and missing password
**Root cause:** Used `method: "DELETE"` but better-auth 1.5.5 exposes the endpoint as `POST`.
Password was sourced from `curPw` (change-password field), always `""` on the delete section.
**Fix:** Changed to `POST`. Added dedicated `delPw` state and a password input on the delete
screen. Password is verified server-side via a sign-in request before deletion proceeds.

#### Editor — no node visible / cannot add nodes on a single scene
**Root cause:** SSR/hydration mismatch. `useState` lazy initializers run on the server where
`localStorage` is unavailable, producing empty state. React hydrates the client with that same
empty server state and never re-runs the initializers.
**Fix:** `useTree()` now accepts `initialData`. `editor.tsx` parses `project.data` and passes it
directly: `useTree(initialData)`. A `useEffect` also auto-selects the root node when `sel` is null.

#### Editor — `TypeError: Unsupported type of value` on autosave
**Root cause:** `params.projectId` is `undefined` when the action fires on the parent `/editor`
route. libsql rejects `undefined` as a query parameter.
**Fix:** Early guard added: `if (!id) return { ok: false, error: "No project ID" }`.

#### Projects — auto-creating project on first visit
**Root cause:** Visiting `/editor` with no projects silently created "My first project".
**Fix:** `/editor` with no projects now redirects to `/projects` to let the user name and create
their first project intentionally.

#### Forgot password — email never sent, errors swallowed
**Root cause:** `doForgot` caught all errors and always transitioned to `forgot-sent` regardless
of whether the API call succeeded.
**Fix:** Response is now checked. `!res.ok` or network failure shows a toast. Only a `2xx`
response advances to `forgot-sent`.

---

### New features

#### Guest mode in editor
Unauthenticated users visiting `/editor` now see a modal with two options:
- **Sign in / Create account** — navigates to `/login`
- **Continue as guest** — dismisses with a localStorage-only warning

Previously, unauthenticated users were immediately hard-redirected to `/login`.

#### Logged-in users skip the landing page
Loader added to `home.tsx` — if a valid session exists, immediately redirects to `/editor`.

#### Global toast notification system (`app/components/Toast.tsx`)
Reusable toast component used across all routes:
- Types: `error` (red), `success` (green), `loading` (indigo spinner, never auto-dismisses)
- `useToast()` hook: `show()`, `showLoading()`, `resolve()`, `dismiss()`
- `resolve(id, message, type)` transitions a loading toast to success/error without flicker
- Auto-dismisses after 4 s; click to dismiss early
- Wired into: forgot password errors, autosave errors, account change-password errors

---

### Notes — LastPass console errors

The `Unchecked runtime.lastError: Cannot create item with duplicate id` errors are produced by the
**LastPass browser extension** injecting context menu items. These are not application errors and
cannot be fixed in the app. Disable the LastPass extension to suppress them.


# Changelog

All notable changes to Inkgraph are documented here.

---

## [Unreleased] — Dev session fixes and features

---

### Round 1 — Auth, routing infrastructure, and editor stability

#### Auth — sign-out not working
**Root cause:** `cookieCache` in `auth.server.ts` with a 5-minute TTL kept the signed cookie valid even after the DB session was deleted.
**Fix:** Removed `cookieCache`. Every request now validates against the database.

#### Auth — sign-out and delete-account silently failing
**Root cause:** Raw `fetch()` calls to better-auth endpoints were silently failing. The sign-out `finally` block always redirected regardless of success.
**Fix:** Both moved to a server-side React Router `action` via `useFetcher`. The action proxies through `auth.handler()` directly and throws a redirect with `Set-Cookie: Max-Age=0`.

#### Auth — delete-account wrong method and missing password
**Root cause:** Used `method: "DELETE"` (better-auth uses `POST`). Password was sourced from `curPw` (change-password field), always `""` on the delete screen.
**Fix:** Changed to `POST`. Added dedicated `delPw` state and password input on the delete screen.

#### Forgot password — 404 and errors swallowed
**Root cause:** `api.auth.$.ts` imported `Route.LoaderArgs`/`Route.ActionArgs` from `./+types/api.auth.$` — a file that only exists after `react-router typegen`. Without it the module silently failed to export its handlers and every `/api/auth/*` request 404'd. `doForgot` also swallowed all errors and always transitioned to `forgot-sent`.
**Fix:** Replaced all `Route.*Args` / `Route.ComponentProps` with inline types across all routes (`home.tsx`, `editor.tsx`, `account.tsx`, `projects.tsx`, `api.auth.$.ts`). Forgot password moved to a server-side action that proxies through `auth.handler()` directly. Response is now checked; errors surface as toasts.

**Additional auth.server.ts fixes:** Added `baseURL` config so better-auth can build callback URLs. Added `localhost:5174` to `trustedOrigins`. `sendResetPassword` hook now passes the full URL better-auth provides directly instead of extracting the token and reconstructing with `APP_URL` (which broke on wrong port or missing env var).

**Login form:** Wrapped login and register fields in `<form>` elements so browsers and password managers recognise the password field context.

#### Editor — no nodes visible on initial load
**Root cause:** SSR/hydration mismatch. `useState` lazy initializers ran on the server where localStorage is unavailable, producing empty state. React hydrated the client with that empty server state; localStorage seeding in `editor.tsx` was too late.
**Fix:** `useTree()` now accepts `initialData`. `editor.tsx` parses `project.data` and passes it directly. A `useEffect` auto-selects the root node when `sel` is null and `rootId` is available.

#### Autosave — "Unsupported type of value" crash
**Root cause:** `params.projectId` was `undefined` when the action fired on the parent `/editor` route. libsql rejects `undefined`.
**Fix:** `project.id` is now included in the form data and read via `form.get("id")` server-side. Params used only as fallback.

#### Projects — auto-creating project on first visit
**Root cause:** Visiting `/editor` with no projects silently created "My first project".
**Fix:** Redirects to `/projects` so users name their first project intentionally.

#### Global toast system (`app/components/Toast.tsx`)
New reusable toast component. Types: `error`, `success`, `loading` (spinner, no auto-dismiss). `useToast()` hook with `show()`, `showLoading()`, `resolve()`, `dismiss()`. Wired into forgot password errors, autosave errors, and account page errors.

---

### Round 2 — Node behaviour, undo, canvas, simulator, and project flow

#### Smart N key — node creation with choices
`addNodeSmart` replaces raw `addNode` as the N key action. When the selected node has choices: finds the first unconnected choice and links the new node to it. When all choices are filled: adds a new choice and links it. Falls through to `nextId` only when no choices exist.

**Root bug:** `addNodeSmart` read `nodes[fromId]` from the render-time closure. Pressing C then N immediately showed stale empty choices. Fixed by rewriting as a `setNodesByScene` functional updater (always receives live state) and storing `activeSceneId` in a ref (`activeSceneIdRef`) to avoid stale scene reads.

`addNodeSmart` was also missing from the `useTree` return object — added.

#### Undo (Z key + button)
`useTree` maintains a 50-snapshot history stack. Every `setNodes` call pushes the current `nodesByScene` before mutating. `undo()` pops and restores. Wired to Z key and "↩ Undo" button in the desktop node panel.

#### Canvas pan sticking
Releasing the mouse outside the SVG left `panning = true` indefinitely. Added a `window` `mouseup` listener that resets `dragN`, `panning`, and `lastM` on any release anywhere.

#### Dialogue Simulator (`app/routes/simulator.tsx` — new)
`/simulator` route. Pick project + scene, play through dialogue:
- Typewriter text reveal, click to skip
- Human silhouette avatars coloured per character
- Past dialogue fades to 45% opacity
- Numbered choice buttons, END badge on terminal choices
- End screen: choices made, full dialogue log, replay / back buttons

Simulator section added to landing page with a live mock dialogue window. "Dialogue Simulator" section added to the Guide modal. 🎭 Simulate button added to editor topbar and as a full-size button in projects page header.

#### Projects page — guest support and loading bar
Logged-out users can access `/projects`. All CRUD for guests uses localStorage under `inkgraph-guest-projects`. Server import `emptyProjectData` moved to a client-safe inline copy to avoid React Router's server/client code-splitting enforcement. Animated top loading bar tied to `fetcher.state`.

#### Project creation flow
All users land on `/projects` when they have no open project. Create modal auto-opens when `projects.length === 0` (evaluated separately for guests after localStorage loads to avoid a race condition). Cancelling while empty navigates to `/`. Every project created with `emptyProjectData()` which always includes a root node.

#### Project card — dropdown menu
Restored the ⋯ dropdown (Open / Rename / Edit / Delete) on project cards. Removed `overflow: hidden` from the card container that was clipping the dropdown. Dropdown now renders as a proper overlay outside the card bounds.

#### Editor — project name saving
Added `doRenameSave` fired on input blur, posting a lightweight `rename` intent to `updateProjectMeta` (name only, no tree data). Full autosave (30s) still sends name too. For guests, name written to `localStorage` (`vn2-project-name`) on blur and read back on editor open.

---

### Notes — browser extension console errors
`Unchecked runtime.lastError: Cannot create item with duplicate id` errors come from the LastPass browser extension injecting context menu items. These are not application errors and cannot be fixed in the app.