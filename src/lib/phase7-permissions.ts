import { MembershipRole } from "@prisma/client";

/** Schedule surfaces: all roles except MEMBER. */
export function canViewSchedule(role: MembershipRole): boolean {
  return role !== MembershipRole.MEMBER;
}

/** Create, reschedule, cancel scheduled work — office and management band only. */
export function canMutateSchedule(role: MembershipRole): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.ADMIN ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.OFFICE
  );
}
