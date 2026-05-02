import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration for middleware.
 * No Prisma or Node-only imports.
 *
 * Do not set `secret` here: it must be supplied alongside this object so middleware and
 * `auth.ts` both call {@link resolveAuthSecret} and stay aligned (see middleware.ts, auth.ts).
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isApp = nextUrl.pathname.startsWith("/app");
      if (isApp && !auth?.user) {
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
