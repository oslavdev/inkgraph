import { auth } from "../server/auth.server"
import type { Route } from "./+types/api.auth.$"

/**
 * better-auth handles all auth endpoints under /api/auth/*
 * e.g. POST /api/auth/sign-in/email
 *      POST /api/auth/sign-up/email
 *      POST /api/auth/sign-out
 *      POST /api/auth/forget-password
 *      POST /api/auth/reset-password
 *      POST /api/auth/change-password
 *      DELETE /api/auth/delete-user
 */
export async function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request)
}

export async function action({ request }: Route.ActionArgs) {
  return auth.handler(request)
}
