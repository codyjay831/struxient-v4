import { Buffer } from "node:buffer";

import { PORTAL_FILE_UPLOAD_GENERIC_ERROR } from "@/server/phase11/portal-file-upload-messages";
import {
  PortalFileUploadValidationError,
  validatePortalFileUploadNote,
  validatePortalUploadBatch,
  validatePortalUploadPart,
  type ValidatedPortalUploadPart,
} from "@/server/phase11/portal-file-upload-validation";

export type ParsedPortalMultipartUpload =
  | { ok: true; rawToken: string; optionalNote: string | undefined; parts: ValidatedPortalUploadPart[] }
  | { ok: false; error: string };

/**
 * Parses multipart `FormData` from a portal upload request and validates file payloads server-side.
 */
export async function parseAndValidatePortalFileUploadFormData(formData: FormData): Promise<ParsedPortalMultipartUpload> {
  const rawToken = String(formData.get("portalToken") ?? "").trim();
  if (!rawToken) {
    return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
  }

  const optionalNoteRaw = formData.get("optionalNote");
  const optionalNote =
    optionalNoteRaw == null || optionalNoteRaw === "" ? undefined : String(optionalNoteRaw);

  let normalizedNote: string;
  try {
    normalizedNote = validatePortalFileUploadNote(optionalNote);
  } catch (e) {
    if (e instanceof PortalFileUploadValidationError) {
      return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
    }
    throw e;
  }
  const optionalNoteNormalized = normalizedNote.length > 0 ? normalizedNote : undefined;

  const entries = formData.getAll("files");
  const parts: ValidatedPortalUploadPart[] = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }
    if (entry.size === 0) {
      continue;
    }
    const buf = Buffer.from(await entry.arrayBuffer());
    try {
      parts.push(
        validatePortalUploadPart({
          originalFilename: entry.name || "upload",
          declaredContentType: entry.type || "application/octet-stream",
          buffer: buf,
        }),
      );
    } catch (e) {
      if (e instanceof PortalFileUploadValidationError) {
        return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
      }
      throw e;
    }
  }

  try {
    validatePortalUploadBatch(parts);
  } catch (e) {
    if (e instanceof PortalFileUploadValidationError) {
      return { ok: false, error: PORTAL_FILE_UPLOAD_GENERIC_ERROR };
    }
    throw e;
  }

  return { ok: true, rawToken, optionalNote: optionalNoteNormalized, parts };
}
