import { NextResponse } from "next/server";

import { createPortalFileUploadSubmissionFromToken } from "@/server/phase11/portal-file-upload-submission";
import { parseAndValidatePortalFileUploadFormData } from "@/server/phase11/portal-file-upload-from-request";

export const runtime = "nodejs";

/** Multipart portal uploads can approach the 25 MiB batch cap. */
export const maxDuration = 120;

export async function POST(request: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const parsed = await parseAndValidatePortalFileUploadFormData(formData);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const result = await createPortalFileUploadSubmissionFromToken({
    rawToken: parsed.rawToken,
    optionalNote: parsed.optionalNote,
    parts: parsed.parts,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
