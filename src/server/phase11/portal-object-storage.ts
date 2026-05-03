import type { Readable } from "node:stream";

export type PortalPutObjectParams = {
  key: string;
  body: Buffer;
  contentType: string;
};

/** Private blob storage for portal intake files (local disk or S3-compatible). */
export interface PortalObjectStorage {
  putObject(params: PortalPutObjectParams): Promise<void>;
  getObjectStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
}

export function assertSafePortalStorageKey(key: string): void {
  if (!key || key.length > 512) {
    throw new Error("Invalid storage key.");
  }
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
    throw new Error("Invalid storage key.");
  }
  const segments = key.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) {
    throw new Error("Invalid storage key.");
  }
}
