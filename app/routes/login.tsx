import { useState } from "react"
import { redirect, useFetcher, useNavigate, useSearchParams } from "react-router"
import { ToastContainer, useToast } from "../components/toast"
import { auth } from "../server/auth.server"
import { getSession } from "../server/session.server"

const C = {
  bg: "#0a0a0a",
  surface: "#0f0f0f",
  border: "#1e1e1e",
  accent: "#6366f1",
  text: "#e5e5e5",
  muted: "#555",
  dim: "#888",
  danger: "#ef4444",
  success: "#22c55e",
}

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request)
  if (session) throw redirect("/editor")
  return null
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData()
  const intent = form.get("intent") as string

  if (intent === "forget-password") {
    const email = form.get("email") as string
    const redirectTo = form.get("redirectTo") as string
    try {
      const req = new Request(new URL("/api/auth/forget-password", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      })
      const res = await auth.handler(req)
      if (!res.ok) {
        let msg = "Failed to send reset email."
        try { const d = await res.clone().json(); msg = d.message ?? msg } catch { /* empty */ }
        return { ok: false, error: msg }
      }
      return { ok: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send reset email."
      return { ok: false, error: msg }
    }
  }

  return { ok: false, error: "Unknown intent" }
}

type View = "login" | "register" | "forgot" | "forgot-sent"

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
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: FieldProps) {
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
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div
      style={{
        fontSize: 13,
        color: C.danger,
        marginBottom: 14,
        padding: "10px 12px",
        background: "#1a0a0a",
        borderRadius: 5,
        border: "1px solid #3a1010",
      }}
    >
      {msg}
    </div>
  )
}

function PrimaryBtn({
  onClick,
  children,
  loading,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: "100%",
        background: loading || disabled ? "#1a1a2e" : C.accent,
        border: "none",
        borderRadius: 6,
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        padding: "11px",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: loading || disabled ? 0.6 : 1,
        marginTop: 4,
      }}
    >
      {loading ? "…" : children}
    </button>
  )
}

function NavLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: C.accent,
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
        textDecoration: "underline",
      }}
    >
      {children}
    </button>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/editor"
  const { toasts, show: showToast, dismiss: dismissToast } = useToast()
  const forgotFetcher = useFetcher<typeof action>()

  const [view, setView] = useState<View>("login")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPw, setLoginPw] = useState("")

  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPw, setRegPw] = useState("")
  const [regPw2, setRegPw2] = useState("")

  const [forgotEmail, setForgotEmail] = useState("")

  function reset() {
    setError("")
  }

  function go(v: View) {
    reset()
    setView(v)
  }

  async function doLogin() {
    if (!loginEmail || !loginPw) return setError("Please fill in all fields.")
    setLoading(true)
    reset()
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Sign in failed.")
      navigate(redirectTo, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  async function doRegister() {
    if (!regName.trim()) return setError("Name is required.")
    if (!regEmail.trim()) return setError("Email is required.")
    if (regPw.length < 8) return setError("Password must be at least 8 characters.")
    if (regPw !== regPw2) return setError("Passwords do not match.")
    setLoading(true)
    reset()
    try {
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim(), password: regPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Registration failed.")
      navigate(redirectTo, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  function doForgot() {
    if (!forgotEmail.trim()) return setError("Enter your email address.")
    const form = new FormData()
    form.set("intent", "forget-password")
    form.set("email", forgotEmail.trim())
    form.set("redirectTo", `${window.location.origin}/reset-password`)
    forgotFetcher.submit(form, { method: "post" })
  }



  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "25%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "20%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        style={{
          width: "min(420px, 94vw)",
          background: C.surface,
          border: "1px solid #272727",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
          position: "relative",
        }}
      >
        <div style={{ height: 3, background: "linear-gradient(90deg,#6366f1,#a855f7)" }} />
        <div style={{ padding: "28px 28px 24px" }}>
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => {
                // Go back to where they came from, not always the landing page
                const from = searchParams.get("from")
                if (from) { navigate(from); return }
                if (redirectTo && redirectTo !== "/editor") { navigate(redirectTo); return }
                navigate(-1 as never)
              }}
              style={{
                background: "none",
                border: "none",
                color: C.muted,
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
          </div>

          <div
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              color: C.accent,
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            INKGRAPH
          </div>

          {view === "login" && (
            <form onSubmit={(e) => { e.preventDefault(); doLogin() }} noValidate>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: C.text }}>
                Sign in
              </h1>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>Welcome back.</p>
              <Field
                id="login-email"
                label="EMAIL"
                type="email"
                value={loginEmail}
                onChange={setLoginEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                id="login-pw"
                label="PASSWORD"
                type="password"
                value={loginPw}
                onChange={setLoginPw}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <ErrBox msg={error} />
              <PrimaryBtn onClick={doLogin} loading={loading}>
                Sign in
              </PrimaryBtn>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 18,
                  fontSize: 13,
                  color: C.muted,
                }}
              >
                <span>
                  No account? <NavLink onClick={() => go("register")}>Register</NavLink>
                </span>
                <NavLink onClick={() => go("forgot")}>Forgot password?</NavLink>
              </div>
            </form>
          )}

          {view === "register" && (
            <form onSubmit={(e) => { e.preventDefault(); doRegister() }} noValidate>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: C.text }}>
                Create account
              </h1>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>
                Start building your story today.
              </p>
              <Field
                id="reg-name"
                label="FULL NAME"
                value={regName}
                onChange={setRegName}
                placeholder="Jane Doe"
                autoComplete="name"
              />
              <Field
                id="reg-email"
                label="EMAIL"
                type="email"
                value={regEmail}
                onChange={setRegEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                id="reg-pw"
                label="PASSWORD"
                type="password"
                value={regPw}
                onChange={setRegPw}
                placeholder="min 8 characters"
                autoComplete="new-password"
              />
              <Field
                id="reg-pw2"
                label="CONFIRM PASSWORD"
                type="password"
                value={regPw2}
                onChange={setRegPw2}
                placeholder="repeat password"
                autoComplete="new-password"
              />
              <ErrBox msg={error} />
              <PrimaryBtn onClick={doRegister} loading={loading}>
                Create account
              </PrimaryBtn>
              <div style={{ marginTop: 18, fontSize: 13, color: C.muted, textAlign: "center" }}>
                Already have one? <NavLink onClick={() => go("login")}>Sign in</NavLink>
              </div>
            </form>
          )}

          {view === "forgot" && (() => {
            const fd = forgotFetcher.data
            if (fd?.ok) {
              // Success — switch to sent view on next render
              setTimeout(() => setView("forgot-sent"), 0)
            }
            const forgotError = error || (fd && !fd.ok && "error" in fd ? fd.error ?? "" : "")
            const forgotLoading = forgotFetcher.state !== "idle"
            return (
              <form onSubmit={(e) => { e.preventDefault(); doForgot() }} noValidate>
                <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: C.text }}>
                  Reset password
                </h1>
                <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>
                  We&apos;ll send a reset link to your inbox.
                </p>
                <Field
                  id="forgot-email"
                  label="EMAIL"
                  type="email"
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <ErrBox msg={forgotError} />
                <PrimaryBtn onClick={doForgot} loading={forgotLoading}>
                  Send reset link
                </PrimaryBtn>
                <div style={{ marginTop: 18, fontSize: 13, color: C.muted, textAlign: "center" }}>
                  <NavLink onClick={() => go("login")}>← Back to sign in</NavLink>
                </div>
              </form>
            )
          })()}

          {view === "forgot-sent" && (
            <>
              <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: C.text }}>
                  Check your inbox
                </h1>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>
                  If an account exists for <strong style={{ color: C.text }}>{forgotEmail}</strong>,
                  you&apos;ll receive a reset link shortly.
                </p>
                <p style={{ fontSize: 12, color: "#333", marginTop: 10 }}>
                  Check your spam folder if it doesn&apos;t arrive within a few minutes.
                </p>
              </div>
              <PrimaryBtn onClick={() => go("login")}>Back to sign in</PrimaryBtn>
            </>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}