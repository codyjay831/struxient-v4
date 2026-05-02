import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { resolveAuthSecret } from "@/lib/auth-env";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
        });
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email.toLowerCase(),
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.sub;
      if (!userId) {
        return session;
      }

      const membership = await prisma.membership.findFirst({
        where: { userId },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });

      if (membership) {
        session.user.id = userId;
        session.user.email = token.email as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.organizationId = membership.organizationId;
        session.user.organizationName = membership.organization.name;
        session.user.role = membership.role as MembershipRole;
      }

      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return;

      const membership = await prisma.membership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

      await prisma.auditEvent.create({
        data: {
          organizationId: membership?.organizationId ?? null,
          actorUserId: user.id,
          type: "USER_LOGIN",
          payload: { method: "credentials" },
        },
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : undefined;
      const sub = token?.sub;
      if (!sub) return;

      const membership = await prisma.membership.findFirst({
        where: { userId: sub },
        orderBy: { createdAt: "asc" },
      });

      await prisma.auditEvent.create({
        data: {
          organizationId: membership?.organizationId ?? null,
          actorUserId: sub,
          type: "USER_LOGOUT",
          payload: {},
        },
      });
    },
  },
});
