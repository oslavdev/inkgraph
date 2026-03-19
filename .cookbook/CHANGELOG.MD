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