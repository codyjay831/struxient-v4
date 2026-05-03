"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PORTAL_FILE_UPLOAD_MAX_FILES,
  PORTAL_FILE_UPLOAD_MAX_FILE_BYTES,
  PORTAL_FILE_UPLOAD_MAX_TOTAL_BYTES,
  PORTAL_FILE_UPLOAD_NOTE_MAX,
} from "@/lib/portal-file-upload-constants";

type Props = {
  rawToken: string;
};

function formatLimitMb(bytes: number): string {
  return String(Math.round(bytes / (1024 * 1024)));
}

export function PortalFileUploadForm({ rawToken }: Props) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [noteLen, setNoteLen] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (success) {
    return (
      <div
        className="rounded-sm border border-border bg-background/60 px-4 py-4"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-foreground">We received your upload.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The office will review your files. This does not change your scheduled time or project status on its own.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText(null);
    if (!files || files.length === 0) {
      setErrorText("Please choose at least one file to upload.");
      return;
    }

    const fd = new FormData();
    fd.set("portalToken", rawToken);
    const noteEl = (e.currentTarget.elements.namedItem("optionalNote") as HTMLTextAreaElement | null)?.value ?? "";
    fd.set("optionalNote", noteEl);
    for (let i = 0; i < files.length; i++) {
      fd.append("files", files[i]!);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/file-upload", {
        method: "POST",
        body: fd,
      });
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = (await res.json()) as { ok?: boolean; error?: string };
      } catch {
        body = {};
      }
      if (!res.ok || !body.ok) {
        setErrorText(body.error ?? "Something went wrong. Please try again or contact the office.");
        return;
      }
      setSuccess(true);
    } catch {
      setErrorText("Something went wrong. Please try again or contact the office.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="portal-upload-files" className="text-sm font-medium text-foreground">
          Files
        </Label>
        <input
          id="portal-upload-files"
          type="file"
          name="files"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          onChange={(ev) => setFiles(ev.target.files)}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Accepted: JPEG, PNG, WebP, or PDF. Up to {PORTAL_FILE_UPLOAD_MAX_FILES} files per upload, up to{" "}
          {formatLimitMb(PORTAL_FILE_UPLOAD_MAX_FILE_BYTES)} MB each, {formatLimitMb(PORTAL_FILE_UPLOAD_MAX_TOTAL_BYTES)}{" "}
          MB total. Files are reviewed by the office and are not treated as final job documentation until staff confirms
          them.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label htmlFor="portal-upload-note" className="text-sm font-medium text-foreground">
            Note for the office <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {noteLen}/{PORTAL_FILE_UPLOAD_NOTE_MAX}
          </span>
        </div>
        <Textarea
          id="portal-upload-note"
          name="optionalNote"
          rows={3}
          maxLength={PORTAL_FILE_UPLOAD_NOTE_MAX}
          className="min-h-[80px] rounded-sm resize-y"
          placeholder="Optional context for the files (access instructions, room location, etc.)."
          onChange={(ev) => setNoteLen(ev.target.value.length)}
        />
      </div>

      {errorText ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="rounded-sm">
        {submitting ? "Uploading…" : "Upload files"}
      </Button>
    </form>
  );
}
