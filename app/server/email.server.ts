import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? "Inkgraph <noreply@yourdomain.com>"
const APP_URL = process.env.APP_URL ?? "http://localhost:5173"

// ─── Password reset ───────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const url = resetUrl

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Inkgraph password",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e5e5e5;border-radius:8px">
        <div style="font-size:12px;font-weight:700;color:#6366f1;letter-spacing:2px;margin-bottom:24px">INKGRAPH</div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#fff">Reset your password</h1>
        <p style="font-size:14px;color:#888;line-height:1.7;margin:0 0 28px">
          We received a request to reset the password for your account.
          Click the button below to choose a new password. This link expires in <strong style="color:#e5e5e5">1 hour</strong>.
        </p>
        <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;margin-bottom:28px">
          Reset password
        </a>
        <p style="font-size:12px;color:#444;line-height:1.7;margin:0">
          If you didn't request this, you can safely ignore this email.
          Your password won't change until you click the link above.
        </p>
        <p style="font-size:11px;color:#2a2a2a;margin-top:24px;word-break:break-all">
          Or copy this link: ${url}
        </p>
      </div>
    `,
  })
}

// ─── Email verification (optional — wire up if you enable it in better-auth) ─
export async function sendVerificationEmail(to: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Inkgraph email",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e5e5e5;border-radius:8px">
        <div style="font-size:12px;font-weight:700;color:#6366f1;letter-spacing:2px;margin-bottom:24px">INKGRAPH</div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#fff">Verify your email</h1>
        <p style="font-size:14px;color:#888;line-height:1.7;margin:0 0 28px">
          Thanks for signing up. Click the button below to verify your email address.
        </p>
        <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px">
          Verify email
        </a>
      </div>
    `,
  })
}
