import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { resolveAuthSecret } from "@/lib/auth-env";

/**
 * Same secret derivation as `auth.ts`. Middleware runs on `/login` and `/` so Auth.js can
 * attach `Set-Cookie` headers that clear invalid encrypted JWT cookies (RSC `auth()` only
 * consumes JSON and does not forward those headers to the browser).
 */
export default NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
}).auth;

export const config = {
  matcher: ["/app/:path*", "/login", "/"],
};
