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


---

### Round 3 — Quick wins: UX and editor polish

#### Scene panel — node count badge
Each scene row in the sidebar now shows a small node count on the right (e.g. `12`). Reads directly from `nodesByScene[sceneId].nodes`.

#### Scene panel — drag to reorder
Scene rows are now draggable. Drag a scene row and drop it onto another to reorder. Implemented via HTML5 drag-and-drop with visual opacity feedback on the drop target. `reorderScenes(newOrder)` added to `useTree` and its return object.

#### Scene panel — auto-focus rename input
When double-clicking a scene name to rename it, the input now auto-focuses via a `useEffect` watching the `editing` state. Previously the input appeared but required an extra click.

#### Scene panel — Enter to confirm rename
The rename input already accepted Enter, but now properly calls `e.preventDefault()` to avoid bubbling, and the `onKeyDown` is more reliable.

#### Canvas — Jump to Root button
A small "Root" button (with a home icon) is now permanently visible in the bottom-left corner of the canvas. Clicking it pans the canvas so the root node is at the top-left and selects it. Also wired to the `Home` keyboard shortcut.

#### NodePanel — collapsible choices list
The CHOICES section header is now a clickable toggle showing ▶/▼ and the count (`CHOICES (3)`). Collapsing hides all choice rows to reduce scroll when a node has many choices.

#### Keyboard shortcuts
- `Home` — jump to root node (pan canvas + select)
- Updated HOTKEYS overlay and Guide modal table


---

### Round 4 — Save system, guest migration, and returning player

#### localStorage-first save architecture (editor.tsx)
Complete rewrite of the save system. Previously the editor relied solely on a 30s autosave interval posting to the DB, meaning any navigation or tab close between intervals lost data.

New architecture:
- **Every tree change writes to localStorage immediately** via a `useEffect([currentDataStr])`. `useTree` already kept `vn2-*` keys in sync; the new layer additionally updates the guest project entry and the logged-in pending snapshot on every change.
- **Guests**: `inkgraph-guest-projects` is updated on every change. Save status transitions to "Saved" automatically after 1.5s. No manual save needed.
- **Logged-in users**: `vn2-pending-{projectId}` is written on every change. This snapshot survives hard closes, crashes, and forced tab kills. DB sync happens via the manual Save button or every 60s auto-sync.
- **On load for logged-in**: if `vn2-pending-{projectId}` exists, the editor auto-submits it silently with a "Syncing unsaved changes from your last session…" toast, then deletes the key on success.
- **Navigate away**: guests navigate freely (already saved). Logged-in with unsynced data get a `window.confirm` explaining that data is safe locally and will re-sync on next open.
- **Tab/window close**: `beforeunload` triggers the browser's native "Leave site?" prompt when logged-in and dirty.

#### Explicit Save button (editor.tsx)
Replaced the old passive status text with a real interactive button:
- **Dirty**: indigo filled, "Save", indigo glow — clearly actionable
- **Saving**: muted, "Syncing…", disabled
- **Saved**: dark green background, green border, ✓ checkmark, green glow
- **Idle**: muted, ✓ checkmark, disabled — nothing to sync

Save button is disabled entirely for guests (always saved to localStorage already).

#### Fix: save on "← Projects" navigation (editor.tsx)
Previously the back button called `navigate("/projects")` directly. React Router's client-side navigation bypasses `beforeunload`, so data was lost. The button now calls `doSaveRef.current()` before navigating for guests (instant localStorage write), and shows a confirm dialog for logged-in users with unsynced changes.

#### Fix: variable declared before useRef (editor.tsx)
`lastSavedDataRef` was referenced in an init block before the `useRef` call that created it — a hard TypeScript/Biome error (`noInvalidUseBeforeDeclaration`). Fixed by moving the init block and `currentDataStr` computation to after the ref declaration.

#### Guest → account project migration (login.tsx, api.migrate-guest-projects.ts)
When a guest registers or signs in, all projects from `inkgraph-guest-projects` are automatically imported into their account:

1. `migrateGuestProjects()` runs client-side immediately after successful auth
2. POSTs the guest project array to `POST /api/migrate-guest-projects`
3. Server requires a valid session, then calls `createProject` for each entry
4. Guest localStorage is cleared — account becomes the single source of truth

**Merge strategy** for the edge case where the account already has projects (e.g. user forgot they registered, created guest projects, then logged in on another device):
- Same name exists → incoming project is renamed `"<name> (imported)"` — nothing is overwritten
- New name → imported as-is
- Both versions are always preserved

#### Returning player cookie + welcome-back banner (projects.tsx)
When a guest creates their first project, a 1-year cookie `inkgraph-returning=1` is set. On the projects page, if the user is a guest, has this cookie, and has at least one local project, a banner appears:

> 👋 **Welcome back!** Your projects are saved locally. **Sign in to sync to the cloud** and access from any device.

Two actions: **Sign in** (navigates to `/login?from=/projects`) and **Dismiss**. The banner reappears on every visit until they sign in or dismiss. After sign-in and migration, `inkgraph-guest-projects` is cleared so the banner condition stops being true.

#### Login: context-aware back button (login.tsx)
The "Back to home" button (always navigated to `/`) is now **"Back"** and navigates contextually:
- `?from=` param present → go there (e.g. `/editor` when coming from the editor's Sign in button)
- Otherwise → `navigate(-1)` browser history back

The editor's guest account button now shows **"Sign in"** and navigates to `/login?from=/editor`.

#### Biome lint fixes across all files
- `type="button"` added to all untyped `<button>` elements (80+ across routes and editor-core)
- `forEach` → `for...of` in 4 places (`home.tsx` BLOBS, `editor-core.jsx` delNode and two choices loops); closing braces corrected
- Bare template literals without `${}` → double-quoted strings (13 in editor-core, 2 in simulator)
- `aria-hidden="true"` added to all decorative SVGs missing it
- `onKeyDown` added to all interactive non-button elements (Arrow `<g>`, color swatches, tag/character selectors, guide nav dots)
- `htmlFor` + matching `id` added to all 6 labels in the ProfileModal mockup form
- Duplicate `type="button"` removed from login back button

#### GitHub Actions + semantic-release
- `.github/workflows/release.yml` — triggers on push to `main`, runs `semantic-release`
- `.releaserc.json` — conventional commits → CHANGELOG → package.json bump → GitHub Release (no npm publish)
- `.commitlintrc.json` — enforces conventional commit format
- `.husky/pre-commit` + `.husky/commit-msg` — lint-staged (Biome) and commitlint hooks