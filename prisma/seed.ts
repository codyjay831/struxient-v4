import { PrismaClient, MembershipRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "admin@struxient.local").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "SEED_OWNER_PASSWORD is required and must be at least 12 characters. Set it in your environment before running the seed.",
    );
  }

  const orgName = process.env.SEED_ORG_NAME ?? "Struxient Dev";
  const orgSlug = process.env.SEED_ORG_SLUG ?? "struxient-dev";

  const passwordHash = await bcrypt.hash(password, 12);

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    create: { name: orgName, slug: orgSlug },
    update: { name: orgName },
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Organization Owner",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "Organization Owner",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: MembershipRole.OWNER,
    },
    update: { role: MembershipRole.OWNER },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: org.id,
      actorUserId: user.id,
      type: "SEED_COMPLETED",
      payload: { email: user.email },
    },
  });

  console.log("Seed complete:", { organizationId: org.id, userId: user.id, email });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
