import { createHash } from "node:crypto";
import path from "node:path";

import {
  PORTAL_FILE_UPLOAD_ALLOWED_DECLARED_MIMES,
  PORTAL_FILE_UPLOAD_ALLOWED_EXTENSIONS,
  PORTAL_FILE_UPLOAD_BLOCKED_EXTENSIONS,
  PORTAL_FILE_UPLOAD_CANONICAL_MIMES,
  PORTAL_FILE_UPLOAD_MAX_FILE_BYTES,
  PORTAL_FILE_UPLOAD_MAX_FILES,
  PORTAL_FILE_UPLOAD_MAX_TOTAL_BYTES,
  PORTAL_FILE_UPLOAD_NOTE_MAX,
  isBlockedDeclaredMime,
} from "@/lib/portal-file-upload-constants";
import { sniffContentMime } from "@/server/phase11/portal-file-magic";

export type ValidatedPortalUploadPart = {
  buffer: Buffer;
  originalFilename: string;
  sanitizedFilename: string;
  contentType: string;
  detectedContentType: string;
  sizeBytes: number;
  checksumSha256: string;
};

function extensionFromFilename(filename: string): string {
  const base = path.basename(filename.trim());
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot).toLowerCase();
}

const EXTENSION_TO_CANONICAL: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/** Strip path segments and unsafe characters; limit length. */
export function sanitizePortalUploadFilename(original: string): string {
  const base = path.basename(original.trim().replace(/\\/g, "/"));
  const withoutNulls = base.replace(/\0/g, "");
  const ascii = withoutNulls.replace(/[^\w.\- ()[\]]+/g, "_");
  const collapsed = ascii.replace(/_+/g, "_").trim();
  const limited = collapsed.slice(0, 180);
  return limited.length > 0 ? limited : "upload";
}

export class PortalFileUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalFileUploadValidationError";
  }
}

function assertMimeMatchesExtension(ext: string, canonical: string): void {
  const expected = EXTENSION_TO_CANONICAL[ext];
  if (!expected || expected !== canonical) {
    throw new PortalFileUploadValidationError("MIME_EXTENSION_MAGIC_MISMATCH");
  }
}

/**
 * Validates note length (optional empty string allowed).
 */
export function validatePortalFileUploadNote(note: string | undefined): string {
  const t = (note ?? "").trim();
  if (t.length > PORTAL_FILE_UPLOAD_NOTE_MAX) {
    throw new PortalFileUploadValidationError("NOTE_TOO_LONG");
  }
  return t;
}

/**
 * Validates a single file buffer + metadata. Throws {@link PortalFileUploadValidationError} on failure.
 */
export function validatePortalUploadPart(params: {
  originalFilename: string;
  declaredContentType: string;
  buffer: Buffer;
}): ValidatedPortalUploadPart {
  const { originalFilename, declaredContentType, buffer } = params;

  if (buffer.length === 0) {
    throw new PortalFileUploadValidationError("EMPTY_FILE");
  }
  if (buffer.length > PORTAL_FILE_UPLOAD_MAX_FILE_BYTES) {
    throw new PortalFileUploadValidationError("FILE_TOO_LARGE");
  }

  const ext = extensionFromFilename(originalFilename);
  if (!ext || !PORTAL_FILE_UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
    throw new PortalFileUploadValidationError("BAD_EXTENSION");
  }

  if (PORTAL_FILE_UPLOAD_BLOCKED_EXTENSIONS.has(ext)) {
    throw new PortalFileUploadValidationError("BLOCKED_EXTENSION");
  }

  const declared = declaredContentType.trim().toLowerCase();
  if (isBlockedDeclaredMime(declared)) {
    throw new PortalFileUploadValidationError("BLOCKED_MIME");
  }

  const declaredOk =
    declared === "application/octet-stream" || PORTAL_FILE_UPLOAD_ALLOWED_DECLARED_MIMES.has(declared);
  if (!declaredOk) {
    throw new PortalFileUploadValidationError("BAD_DECLARED_MIME");
  }

  const sniffed = sniffContentMime(buffer);
  if (!sniffed || !PORTAL_FILE_UPLOAD_CANONICAL_MIMES.has(sniffed)) {
    throw new PortalFileUploadValidationError("BAD_MAGIC");
  }

  assertMimeMatchesExtension(ext, sniffed);

  if (declared !== "application/octet-stream" && declared !== sniffed) {
    throw new PortalFileUploadValidationError("DECLARED_VS_MAGIC_MISMATCH");
  }

  const sanitizedFilename = sanitizePortalUploadFilename(originalFilename);
  const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    buffer,
    originalFilename: originalFilename.trim().slice(0, 500) || sanitizedFilename,
    sanitizedFilename,
    contentType: declared === "application/octet-stream" ? sniffed : declared,
    detectedContentType: sniffed,
    sizeBytes: buffer.length,
    checksumSha256,
  };
}

/**
 * Validates full multi-file upload before persistence.
 */
export function validatePortalUploadBatch(parts: ValidatedPortalUploadPart[]): void {
  if (parts.length === 0) {
    throw new PortalFileUploadValidationError("NO_FILES");
  }
  if (parts.length > PORTAL_FILE_UPLOAD_MAX_FILES) {
    throw new PortalFileUploadValidationError("TOO_MANY_FILES");
  }
  const total = parts.reduce((s, p) => s + p.sizeBytes, 0);
  if (total > PORTAL_FILE_UPLOAD_MAX_TOTAL_BYTES) {
    throw new PortalFileUploadValidationError("TOTAL_TOO_LARGE");
  }
}
