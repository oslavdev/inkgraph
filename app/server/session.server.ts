import { auth } from "./auth.server"
import type { AuthUser } from "./auth.server"

/**
 * Get the current session from a Request.
 * Returns null if not authenticated.
 */
export async function getSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session ?? null
}

/**
 * Require authentication — throws a redirect to /login if not signed in.
 * Use in loaders for protected routes.
 */
export async function requireUser(request: Request): Promise<AuthUser> {
  const session = await getSession(request)
  if (!session) {
    const url = new URL(request.url)
    throw new Response(null, {
      status: 302,
      headers: { Location: `/login?redirect=${encodeURIComponent(url.pathname)}` },
    })
  }
  return session.user
}
