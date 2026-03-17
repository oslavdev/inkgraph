import { useState } from "react"
import { useLoaderData, useNavigate } from "react-router"
import type { LoaderFunctionArgs } from "react-router"

const C = {
  bg: "#0a0a0a",
  surface: "#0f0f0f",
  accent: "#6366f1",
  text: "#e5e5e5",
  muted: "#555",
  danger: "#ef4444",
  success: "#22c55e",
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token) {
    throw new Response("Missing reset token", { status: 400 })
  }
  return { token }
}

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

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token } = useLoaderData() as { token: string }
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function doReset() {
    if (pw.length < 8) return setError("Password must be at least 8 characters.")
    if (pw !== pw2) return setError("Passwords do not match.")
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? "Reset failed.")
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
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
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "30%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        style={{
          width: "min(420px,94vw)",
          background: C.surface,
          border: "1px solid #272727",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ height: 3, background: "linear-gradient(90deg,#6366f1,#a855f7)" }} />
        <div style={{ padding: "28px 28px 24px" }}>
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

          {!done ? (
            <>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: C.text }}>
                Choose new password
              </h1>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>
                Must be at least 8 characters.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="pw-new"
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: C.muted,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  NEW PASSWORD
                </label>
                <input
                  id="pw-new"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="pw-confirm"
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: C.muted,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  CONFIRM PASSWORD
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              {error && (
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
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={doReset}
                disabled={loading}
                style={{
                  width: "100%",
                  background: loading ? "#1a1a2e" : C.accent,
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "11px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: loading ? 0.6 : 1,
                  marginTop: 4,
                }}
              >
                {loading ? "…" : "Set new password"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: C.text }}>
                Password updated
              </h1>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: "0 0 24px" }}>
                You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  background: C.accent,
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "11px 28px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
