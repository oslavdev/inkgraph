import { auth } from "../server/auth.server"

/**
 * better-auth handles all auth endpoints under /api/auth/*
 * e.g. POST /api/auth/sign-in/email
 *      POST /api/auth/sign-up/email
 *      POST /api/auth/sign-out
 *      POST /api/auth/forget-password
 *      POST /api/auth/reset-password
 *      POST /api/auth/change-password
 *      POST /api/auth/delete-user
 */
export async function loader({ request }: { request: Request }) {
  return auth.handler(request)
}

export async function action({ request }: { request: Request }) {
  return auth.handler(request)
}
