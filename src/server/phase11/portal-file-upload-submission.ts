import { randomUUID } from "node:crypto";
import path from "node:path";

import { CustomerPortalSubmissionStatus, CustomerPortalSubmissionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import {
  PORTAL_FILE_UPLOAD_DEFAULT_MESSAGE_TEXT,
  PORTAL_FILE_UPLOAD_GENERIC_ERROR,
} from "@/server/phase11/portal-file-upload-messages";
import { resolvePortalTokenForSubmission } from "@/server/phase9/portal-submission-token-resolve";
import { PORTAL_ACTION_THROTTLED_MESSAGE } from "@/server/phase10/portal-phase10-messages";
import {
  consumePortalPostRateLimitSlot,
  PortalPostRateLimitedError,
} from "@/server/phase10/portal-post-rate-limit";
import { getPortalObjectStorage } from "@/server/phase11/portal-object-storage-factory";
import type { ValidatedPortalUploadPart } from "@/server/phase11/portal-file-upload-validation";
import {
  PortalFileUploadValidationError,
  validatePortalFileUploadNote,
  validatePortalUploadBatch,
} from "@/server/phase11/portal-file-upload-validation";

export type PortalFileUploadCreateResult =
  | { ok: true; quoteId: string; jobId: string | null }
  | { ok: false; error: string };

function buildStorageKey(params: {
  organizationId: string;
  submissionId: string;
  sanitizedFilename: string;
}): string {
  const suffix = safeFileSuffix(params.sanitizedFilename);
  const fragment = randomUUID();
  return `${params.organizationId}/portal/${params.submissionId}/${fragment}_${suffix}`;
}

function safeFileSuffix(sanitized: string): string {
  const base = path
    .basename(sanitized)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "file").slice(0, 80);
}

/**
 * Persists a FILE_UPLOAD portal submission with validated file parts. Scope is derived only from the portal token.
 */
export async function createPortalFileUploadSubmissionFromToken(params: {
  rawToken: string;
  optionalNote?: string;
  parts: ValidatedPortalUploadPart[];
  now?: Date;
}): Promise<PortalFileUploadCreateResult> {
  const rawToken = params.rawToken?.trim();
  if (!rawToken) {
    return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
  }

  const tokenHash = hashPortalToken(rawToken);
  try {
    await consumePortalPostRateLimitSlot({
      tokenHash,
      action: "PORTAL_FILE_UPLOAD",
      now: params.now,
    });
  } catch (e) {
    if (e instanceof PortalPostRateLimitedError) {
      return { ok: false, error: PORTAL_ACTION_THROTTLED_MESSAGE };
    }
    throw e;
  }

  const scope = await resolvePortalTokenForSubmission(rawToken);
  if (!scope) {
    return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
  }

  let note: string;
  try {
    note = validatePortalFileUploadNote(params.optionalNote);
    validatePortalUploadBatch(params.parts);
  } catch (e) {
    if (e instanceof PortalFileUploadValidationError) {
      return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
    }
    throw e;
  }

  const messageBody = note.length > 0 ? note : PORTAL_FILE_UPLOAD_DEFAULT_MESSAGE_TEXT;

  let storage;
  try {
    storage = getPortalObjectStorage();
  } catch {
    return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
  }

  const submission = await prisma.customerPortalSubmission.create({
    data: {
      organizationId: scope.organizationId,
      customerId: scope.customerId,
      quoteId: scope.quoteId,
      jobId: scope.jobId,
      portalAccessTokenId: scope.portalAccessTokenId,
      type: CustomerPortalSubmissionType.FILE_UPLOAD,
      status: CustomerPortalSubmissionStatus.NEW,
      subject: null,
      message: messageBody,
    },
    select: { id: true },
  });

  const uploadedKeys: string[] = [];

  try {
    for (const part of params.parts) {
      const storageKey = buildStorageKey({
        organizationId: scope.organizationId,
        submissionId: submission.id,
        sanitizedFilename: part.sanitizedFilename,
      });
      await storage.putObject({
        key: storageKey,
        body: part.buffer,
        contentType: part.detectedContentType,
      });
      uploadedKeys.push(storageKey);

      await prisma.customerPortalSubmissionAttachment.create({
        data: {
          organizationId: scope.organizationId,
          submissionId: submission.id,
          storageKey,
          originalFilename: part.originalFilename,
          sanitizedFilename: part.sanitizedFilename,
          contentType: part.contentType,
          detectedContentType: part.detectedContentType,
          sizeBytes: part.sizeBytes,
          checksumSha256: part.checksumSha256,
        },
      });
    }
  } catch {
    for (const k of uploadedKeys) {
      await storage.deleteObject(k).catch(() => undefined);
    }
    await prisma.customerPortalSubmission.delete({ where: { id: submission.id } }).catch(() => undefined);
    return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
  }

  await prisma.auditEvent.create({
    data: {
      organizationId: scope.organizationId,
      actorUserId: null,
      type: "CUSTOMER_PORTAL_SUBMISSION_CREATED",
      payload: {
        submissionId: submission.id,
        quoteId: scope.quoteId,
        jobId: scope.jobId ?? "",
        type: CustomerPortalSubmissionType.FILE_UPLOAD,
        attachmentCount: params.parts.length,
      },
    },
  });

  return { ok: true, quoteId: scope.quoteId, jobId: scope.jobId };
}
