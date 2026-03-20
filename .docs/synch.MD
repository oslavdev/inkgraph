# Project Synchronisation Flow

How Inkgraph stores and synchronises project data across localStorage, the database, and user accounts.

---

## Storage layers

| Layer | Key / location | Who writes | Who reads |
|---|---|---|---|
| Live tree | `vn2-scenes`, `vn2-nbs`, `vn2-chars`, `vn2-vars` | `useTree` on every state change | `useTree` on mount |
| Active project name | `vn2-project-name` | Editor on every name change | Editor on mount |
| Guest project list | `inkgraph-guest-projects` | Editor on every tree change | Projects page, `openProject` |
| Pending DB sync | `vn2-pending-{projectId}` | Editor on every tree change (logged-in) | Editor on mount (logged-in) |
| Database | `project` table (Turso/SQLite) | Manual Save, 60s auto-sync, migration | Editor loader, Projects loader |

---

## Guest flow

```
User visits /projects (no account)
        │
        ▼
Create project (name it)
        │
        ├── mkGuestProject() builds entry with emptyProjectData()
        ├── inkgraph-guest-projects updated in localStorage
        ├── vn2-* keys seeded with project data
        ├── vn2-project-name set
        └── inkgraph-returning=1 cookie set (1 year)
        │
        ▼
/editor opens (no DB project, user=null)
        │
        ▼
User edits nodes / scenes
        │
        ├── useTree writes vn2-* keys on every state change
        └── Editor useEffect([currentDataStr]) fires on every change
                │
                ├── vn2-project-name updated
                ├── inkgraph-guest-projects entry updated with full data
                └── saveStatus → "Saved" after 1.5s (no DB needed)
        │
        ▼
User navigates back to /projects
        │
        └── openProject() reads entry from inkgraph-guest-projects
            and re-seeds vn2-* keys — latest data is always there
```

**Guest data never leaves the browser.** Every change is persisted to `inkgraph-guest-projects` synchronously on each action. There is no "unsaved" state for guests.

---

## Logged-in user flow

```
User opens /editor/:projectId
        │
        ├── Loader reads project.data from DB
        ├── Editor seeds vn2-* keys with DB data
        └── lastSavedDataRef set to DB snapshot
        │
        ▼
Check for pending sync on mount
        │
        ├── vn2-pending-{projectId} exists?
        │       │
        │       YES → POST autosave to DB silently
        │             Show "Syncing unsaved changes..." toast
        │             On success → delete vn2-pending-{projectId}
        │
        └── NO → continue normally
        │
        ▼
User edits nodes / scenes
        │
        ├── useTree writes vn2-* keys on every change
        └── Editor useEffect([currentDataStr]) fires on every change
                │
                ├── vn2-project-name updated
                ├── vn2-pending-{projectId} written with full snapshot + timestamp
                └── saveStatus → "dirty"
        │
        ▼
        ┌─────────────────────────────────────┐
        │         Sync triggers               │
        └─────────────────────────────────────┘
        │
        ├── Manual Save button pressed
        │       └── POST autosave → DB updated
        │           On success → delete vn2-pending, saveStatus → "Saved"
        │
        ├── 60-second auto-sync interval
        │       └── Same as manual save
        │
        ├── Navigate "← Projects" with dirty status
        │       └── window.confirm shown:
        │           "Data is safe locally, will sync next time you open"
        │           Confirm → navigate (data stays in vn2-pending)
        │           Cancel  → stay in editor
        │
        └── Tab/window close with dirty status
                └── browser "Leave site?" native prompt
                    (beforeunload preventDefault)
```

**Logged-in data has two layers of safety:**
1. `vn2-pending-{projectId}` is written on every change — survives hard closes, crashes, and killed tabs
2. On next open, the pending snapshot is auto-synced to the DB before the user does anything

---

## Guest → account migration

Triggered immediately after a successful sign-in or registration.

```
User signs in / registers
        │
        ▼
migrateGuestProjects() runs client-side
        │
        ├── Read inkgraph-guest-projects from localStorage
        ├── If empty → skip
        │
        └── POST /api/migrate-guest-projects with project array
                │
                ▼
        Server (requires valid session):
                │
                ├── Fetch user's existing project names from DB
                │
                └── For each guest project:
                        │
                        ├── Parse and validate data JSON
                        │
                        ├── Name conflict with existing project?
                        │       YES → rename to "<name> (imported)"
                        │       NO  → use as-is
                        │
                        └── createProject() → inserted into DB
                │
                ▼
        Return { imported: N, skipped: M }
        │
        ▼
Client clears localStorage:
        ├── localStorage.removeItem("inkgraph-guest-projects")
        └── localStorage.removeItem("vn2-project-name")
        │
        ▼
navigate(redirectTo) — account is now source of truth
```

### Merge rules

| Situation | Result |
|---|---|
| Guest project name does not exist in account | Imported as-is |
| Guest project name already exists in account | Imported as `"<name> (imported)"` |
| Guest project has invalid/missing `data` JSON | Skipped, counted in `skipped` |
| Multiple guest projects with the same name | Each gets a unique suffix |

Nothing is ever deleted or overwritten. The user always ends up with both versions.

---

## Returning player detection

```
Guest creates first project
        └── document.cookie = "inkgraph-returning=1; max-age=31536000"

Guest returns to /projects on a later visit
        │
        ├── isGuest = true
        ├── inkgraph-returning=1 cookie present
        └── inkgraph-guest-projects has ≥ 1 project
                │
                ▼
        Banner shown:
        "Welcome back! Sign in to sync to the cloud"
        [Sign in]  [Dismiss]

User clicks Sign in
        └── navigate("/login?from=/projects")
            After login → migrateGuestProjects() → localStorage cleared
            Banner condition (projects.length > 0) is no longer true
```

---

## State machine: saveStatus

```
                    ┌─────────────────────────────┐
                    │                             │
           tree     │                         2s timeout
          changes   ▼                             │
"idle" ──────────► "dirty" ──── Save pressed ──► "saving" ──── DB ok ──► "saved" ──► "idle"
  ▲                                                    │
  │                                                    │ DB error
  └────────────────────────────────────────────────────┘
                                                (toast shown, status reset to "idle")
```

Guests skip this machine entirely — their status is always "Saved" (localStorage write is synchronous and never fails silently).

---

## What survives what

| Event | Guest data | Logged-in data |
|---|---|---|
| Normal navigation | ✅ Saved (continuous localStorage) | ✅ If manual Save pressed or auto-sync fired |
| Browser back / React Router navigate | ✅ | ⚠️ Confirm shown; pending snapshot in localStorage |
| Tab closed / killed | ✅ | ✅ vn2-pending written on last change |
| Browser crash | ✅ | ✅ vn2-pending survives |
| localStorage cleared by user | ❌ Lost | ✅ DB has last synced version |
| DB goes down | ✅ Not affected | ✅ Falls back to localStorage pending |
| Login on different device | ❌ Local only | ✅ DB synced to all devices |