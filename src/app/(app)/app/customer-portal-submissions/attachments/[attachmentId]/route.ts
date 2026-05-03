import { buffer as streamToBuffer } from "node:stream/consumers";

import { CustomerPortalSubmissionAttachmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import { canViewJobEvidence } from "@/lib/phase12-permissions";
import { getPortalObjectStorage } from "@/server/phase11/portal-object-storage-factory";

export const runtime = "nodejs";

function contentDispositionFilename(name: string): string {
  const safe = name.replace(/[\r\n"]/g, "_").slice(0, 180);
  return `attachment; filename="${safe}"`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  const organizationId = session?.user?.organizationId;
  const role = session?.user?.role;

  if (!userId || !organizationId || !role) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const portalOk = canViewCustomerPortalSubmissions(role);
  const evidenceOk = canViewJobEvidence(role);
  if (!portalOk && !evidenceOk) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { attachmentId } = await context.params;

  const row = await prisma.customerPortalSubmissionAttachment.findFirst({
    where: {
      id: attachmentId,
      organizationId,
      status: CustomerPortalSubmissionAttachmentStatus.STORED,
    },
    select: {
      storageKey: true,
      detectedContentType: true,
      contentType: true,
      originalFilename: true,
      sanitizedFilename: true,
    },
  });

  if (!row) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!portalOk && evidenceOk) {
    const linked = await prisma.jobEvidence.findFirst({
      where: {
        organizationId,
        sourceAttachmentId: attachmentId,
      },
      select: { id: true },
    });
    if (!linked) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  let storage;
  try {
    storage = getPortalObjectStorage();
  } catch {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  let bodyBuf: Buffer;
  try {
    bodyBuf = await streamToBuffer(await storage.getObjectStream(row.storageKey));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = row.detectedContentType?.trim() || row.contentType?.trim() || "application/octet-stream";
  const downloadName = row.sanitizedFilename?.trim() || row.originalFilename || "download";

  return new NextResponse(new Uint8Array(bodyBuf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDispositionFilename(downloadName),
      "Cache-Control": "private, no-store",
    },
  });
}
