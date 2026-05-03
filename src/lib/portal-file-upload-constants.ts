/** Allowed declared MIME types for portal uploads (subset validated against magic bytes). */
export const PORTAL_FILE_UPLOAD_ALLOWED_DECLARED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Canonical types after magic-byte detection. */
export const PORTAL_FILE_UPLOAD_CANONICAL_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const PORTAL_FILE_UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const PORTAL_FILE_UPLOAD_MAX_FILES = 5;

export const PORTAL_FILE_UPLOAD_MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/** Optional customer note on upload form (server-enforced). */
export const PORTAL_FILE_UPLOAD_NOTE_MAX = 2000;

export const PORTAL_FILE_UPLOAD_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
]);

/** Dangerous or unsupported extensions (extra guard beyond allowlist). */
export const PORTAL_FILE_UPLOAD_BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".js",
  ".jse",
  ".vbs",
  ".vbe",
  ".wsf",
  ".wsh",
  ".ps1",
  ".psm1",
  ".dll",
  ".sh",
  ".bash",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".tgz",
]);

const BLOCKED_MIME_PREFIXES = [
  "application/x-ms",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-msdownload",
  "application/x-msi",
  "application/x-sh",
  "application/x-csh",
  "application/x-httpd-php",
  "application/javascript",
  "application/x-javascript",
  "text/javascript",
  "application/zip",
  "application/x-zip",
  "application/x-rar",
  "application/x-7z",
];

export function isBlockedDeclaredMime(declared: string): boolean {
  const lower = declared.trim().toLowerCase();
  if (!lower) return true;
  for (const p of BLOCKED_MIME_PREFIXES) {
    if (lower.startsWith(p)) return true;
  }
  return false;
}
