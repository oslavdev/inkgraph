import { useState } from "react"
import { redirect, useFetcher, useNavigate } from "react-router"
import { auth } from "../server/auth.server"
import { ToastContainer, useToast } from "../components/Toast"
import { requireUser } from "../server/session.server"

const C = {
  bg: "#0a0a0a",
  surface: "#111",
  border: "#1e1e1e",
  accent: "#6366f1",
  text: "#e5e5e5",
  muted: "#555",
  dim: "#888",
  danger: "#ef4444",
  success: "#22c55e",
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request)
  return { user }
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request)
  const form = await request.formData()
  const intent = form.get("intent") as string

  if (intent === "sign-out") {
    // Proxy to better-auth sign-out endpoint, then hard-redirect to clear state
    const signOutReq = new Request(new URL("/api/auth/sign-out", request.url), {
      method: "POST",
      headers: request.headers,
    })
    await auth.handler(signOutReq)
    throw redirect("/", {
      headers: {
        "Set-Cookie": "better-auth.session_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
      },
    })
  }

  if (intent === "delete-account") {
    const password = form.get("password") as string
    if (!password) return { ok: false, error: "Password is required." }

    // Verify password via better-auth sign-in
    const verifyReq = new Request(new URL("/api/auth/sign-in/email", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    })
    const verifyRes = await auth.handler(verifyReq)
    if (!verifyRes.ok) return { ok: false, error: "Incorrect password." }

    // Delete the user account via better-auth (projects cascade-delete via FK)
    const deleteReq = new Request(new URL("/api/auth/delete-user", request.url), {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ callbackURL: "/" }),
    })
    await auth.handler(deleteReq)

    throw redirect("/", {
      headers: {
        "Set-Cookie": "better-auth.session_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
      },
    })
  }

  return { ok: false, error: "Unknown intent" }
}

type Section = "main" | "password" | "delete"

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0d0d0d",
  border: "1px solid #2a2a2a",
  borderRadius: 5,
  color: C.text,
  fontSize: 14,
  padding: "10px 12px",
  outline: "none",
  fontFamily: "inherit",
}

interface FieldProps {
  id: string
  label: string
  type?: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
}

function Field({ id, label, type = "text", value, onChange, placeholder, readOnly }: FieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 10,
          fontFamily: "monospace",
          color: C.muted,
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          color: readOnly ? C.muted : C.text,
          cursor: readOnly ? "default" : "text",
        }}
      />
    </div>
  )
}

interface ErrOkBoxProps {
  msg: string
  variant: "error" | "success"
}

function StatusBox({ msg, variant }: ErrOkBoxProps) {
  if (!msg) return null
  const isErr = variant === "error"
  return (
    <div
      style={{
        fontSize: 13,
        color: isErr ? C.danger : C.success,
        marginBottom: 16,
        padding: "10px 12px",
        background: isErr ? "#1a0a0a" : "#0a1a0a",
        borderRadius: 5,
        border: isErr ? "1px solid #3a1010" : "1px solid #1a3a1a",
      }}
    >
      {msg}
    </div>
  )
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      type="button"
      onClick={onBack}
      style={{
        background: "none",
        border: "none",
        color: C.muted,
        fontSize: 13,
        cursor: "pointer",
        padding: "0 0 20px",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M19 12H5M5 12l7-7M5 12l7 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </button>
  )
}

export default function AccountPage({ loaderData }: { loaderData: ReturnType<Awaited<ReturnType<typeof loader>>> extends Promise<infer T> ? T : ReturnType<typeof loader> }) {
  const { user } = loaderData
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof action>()
  const { toasts, show: showToast, dismiss: dismissToast } = useToast()
  const [section, setSection] = useState<Section>("main")

  const [curPw, setCurPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [newPw2, setNewPw2] = useState("")
  const [delPw, setDelPw] = useState("")
  const [delConfirm, setDelConfirm] = useState("")

  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(false)

  const initials = (user.name || user.email).slice(0, 2).toUpperCase()

  function reset() {
    setError("")
    setOk("")
  }

  function doSignOut() {
    const form = new FormData()
    form.set("intent", "sign-out")
    fetcher.submit(form, { method: "post" })
  }

  async function doChangePw() {
    if (!curPw) return setError("Enter your current password.")
    if (newPw.length < 8) return setError("New password must be at least 8 characters.")
    if (newPw !== newPw2) return setError("New passwords do not match.")
    setLoading(true)
    reset()
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      })
      let data: { message?: string } = {}
      try { data = await res.json() } catch { /* empty */ }
      if (!res.ok) throw new Error(data.message ?? "Failed to change password.")
      setCurPw("")
      setNewPw("")
      setNewPw2("")
      setOk("Password updated successfully.")
      setTimeout(() => setSection("main"), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong."
      // Network/unexpected errors go to toast; auth errors stay in the form
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        showToast(msg, "error")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  function doDelete() {
    if (delConfirm.trim().toLowerCase() !== "delete") return setError("Type DELETE to confirm.")
    if (!delPw) return setError("Enter your password to confirm.")
    const form = new FormData()
    form.set("intent", "delete-account")
    form.set("password", delPw)
    fetcher.submit(form, { method: "post" })
  }

  // Show server-side errors from fetcher
  const fetcherError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : ""

  return (
    <div
      style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter',system-ui,sans-serif" }}
    >
      <nav
        style={{
          height: 56,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: "clamp(20px,4vw,48px)",
          background: C.surface,
        }}
      >
        <button
          type="button"
          type="button"
          onClick={() => navigate("/editor")}
          style={{
            background: "none",
            border: "none",
            color: C.muted,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: 1,
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19 12H5M5 12l7-7M5 12l7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to editor
        </button>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.accent,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          INKGRAPH
        </span>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px clamp(20px,4vw,48px)" }}>
        {section === "main" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 36 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#6366f1,#a855f7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  letterSpacing: 1,
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>{user.email}</div>
              </div>
            </div>

            <div
              style={{
                background: "#0f0f0f",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "14px 18px",
                marginBottom: 28,
              }}
            >
              {(
                [
                  { label: "NAME", value: user.name },
                  { label: "EMAIL", value: user.email },
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: C.muted, fontFamily: "monospace" }}>{row.label}</span>
                  <span style={{ color: C.text }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: C.muted, fontFamily: "monospace" }}>VERIFIED</span>
                <span style={{ color: user.emailVerified ? C.success : C.dim }}>
                  {user.emailVerified ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                type="button"
                onClick={() => {
                  setSection("password")
                  reset()
                }}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  color: C.text,
                  fontSize: 14,
                  padding: "13px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 11V7a5 5 0 0 1 10 0v4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Change password
                <svg
                  style={{ marginLeft: "auto" }}
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                type="button"
                onClick={doSignOut}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  color: C.dim,
                  fontSize: 14,
                  padding: "13px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </div>

            <button
              type="button"
              type="button"
              onClick={() => {
                setSection("delete")
                reset()
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #3a1010",
                borderRadius: 7,
                color: "#774444",
                fontSize: 14,
                padding: "13px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete account
            </button>
          </>
        )}

        {section === "password" && (
          <>
            <BackBtn
              onBack={() => {
                setSection("main")
                reset()
              }}
            />
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: C.text }}>
              Change password
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: 13, color: C.muted }}>
              Choose a strong password you don&apos;t use elsewhere.
            </p>
            <Field
              id="cur-pw"
              label="CURRENT PASSWORD"
              type="password"
              value={curPw}
              onChange={setCurPw}
              placeholder="••••••••"
            />
            <Field
              id="new-pw"
              label="NEW PASSWORD"
              type="password"
              value={newPw}
              onChange={setNewPw}
              placeholder="min 8 characters"
            />
            <Field
              id="new-pw2"
              label="CONFIRM NEW PASSWORD"
              type="password"
              value={newPw2}
              onChange={setNewPw2}
              placeholder="repeat new password"
            />
            <StatusBox msg={error} variant="error" />
            <StatusBox msg={ok} variant="success" />
            <button
              type="button"
              type="button"
              onClick={doChangePw}
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#1a1a2e" : C.accent,
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "…" : "Update password"}
            </button>
          </>
        )}

        {section === "delete" && (
          <>
            <BackBtn
              onBack={() => {
                setSection("main")
                setDelPw("")
                setDelConfirm("")
                reset()
              }}
            />
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: C.danger }}>
              Delete account
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: C.muted, lineHeight: 1.75 }}>
              This permanently removes your account and all your saved projects. This cannot be
              undone.
            </p>
            <div
              style={{
                background: "#1a0a0a",
                border: "1px solid #3a1010",
                borderRadius: 7,
                padding: "14px 16px",
                marginBottom: 24,
              }}
            >
              <div
                style={{ fontSize: 12, color: "#cc4444", fontFamily: "monospace", marginBottom: 4 }}
              >
                ALL DATA WILL BE LOST
              </div>
              <div style={{ fontSize: 13, color: "#884444", lineHeight: 1.6 }}>
                All scenes, nodes, characters, variables, and project history will be permanently
                deleted.
              </div>
            </div>
            <Field
              id="del-pw"
              label="YOUR PASSWORD"
              type="password"
              value={delPw}
              onChange={setDelPw}
              placeholder="Enter your password"
            />
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="del-confirm"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: C.muted,
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}
              >
                TYPE &quot;DELETE&quot; TO CONFIRM
              </label>
              <input
                id="del-confirm"
                value={delConfirm}
                onChange={(e) => {
                  setDelConfirm(e.target.value)
                  setError("")
                }}
                placeholder="DELETE"
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  letterSpacing: 2,
                  borderColor: "#3a1010",
                }}
              />
            </div>
            <StatusBox msg={error || fetcherError} variant="error" />
            <button
              type="button"
              type="button"
              onClick={doDelete}
              disabled={fetcher.state !== "idle"}
              style={{
                width: "100%",
                background: "#1a0a0a",
                border: "1px solid #5a2020",
                borderRadius: 6,
                color: C.danger,
                fontSize: 14,
                fontWeight: 600,
                padding: "12px",
                cursor: fetcher.state !== "idle" ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: fetcher.state !== "idle" ? 0.6 : 1,
              }}
            >
              {fetcher.state !== "idle" ? "Deleting…" : "Permanently delete account"}
            </button>
          </>
        )}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}