import type { DefaultSession } from "next-auth";
import type { MembershipRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      organizationId?: string;
      organizationName?: string;
      role?: MembershipRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string | null;
    name?: string | null;
  }
}
