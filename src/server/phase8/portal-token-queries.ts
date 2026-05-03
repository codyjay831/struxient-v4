import { prisma } from "@/lib/prisma";

export async function findPortalAccessTokenByTokenHash(tokenHash: string) {
  return prisma.portalAccessToken.findUnique({
    where: { tokenHash },
    include: {
      organization: { select: { name: true } },
      customer: {
        select: {
          id: true,
          displayName: true,
          contactMethods: {
            where: { archivedAt: null },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: {
              type: true,
              value: true,
              label: true,
              isPrimary: true,
            },
          },
        },
      },
      quote: {
        select: {
          id: true,
          organizationId: true,
          customerId: true,
          jobId: true,
          status: true,
          sentSnapshotJson: true,
          title: true,
        },
      },
    },
  });
}

/** Active = not revoked (expiry checked separately). */
export async function findActivePortalTokenForQuote(organizationId: string, quoteId: string) {
  return prisma.portalAccessToken.findFirst({
    where: {
      organizationId,
      quoteId,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}
