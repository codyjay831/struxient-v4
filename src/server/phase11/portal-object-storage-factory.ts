import path from "node:path";

import { S3Client } from "@aws-sdk/client-s3";

import { PortalLocalObjectStorage } from "@/server/phase11/portal-local-object-storage";
import type { PortalObjectStorage } from "@/server/phase11/portal-object-storage";
import { PortalS3ObjectStorage } from "@/server/phase11/portal-s3-object-storage";

let cached: PortalObjectStorage | null = null;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function resolveLocalRoot(): string {
  return (
    process.env.PORTAL_UPLOAD_LOCAL_ROOT?.trim() ||
    path.join(process.cwd(), ".data", "portal-uploads")
  );
}

/**
 * Returns the shared portal object storage client. In production, S3-compatible credentials
 * and `PORTAL_UPLOAD_S3_BUCKET` are required. Outside production, a private local directory is used
 * when S3 is not fully configured.
 */
export function getPortalObjectStorage(): PortalObjectStorage {
  if (cached) return cached;

  const bucket = process.env.PORTAL_UPLOAD_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  const s3Ready = Boolean(bucket && accessKeyId && secretAccessKey);

  if (isProductionRuntime() && !s3Ready) {
    throw new Error(
      "Production portal uploads require PORTAL_UPLOAD_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  if (s3Ready && bucket && accessKeyId && secretAccessKey) {
    const client = new S3Client({ region });
    cached = new PortalS3ObjectStorage(client, bucket);
    return cached;
  }

  if (isProductionRuntime()) {
    throw new Error("Portal object storage is not configured for production.");
  }

  cached = new PortalLocalObjectStorage(resolveLocalRoot());
  return cached;
}

/** Test helper: reset singleton between tests. */
export function resetPortalObjectStorageCacheForTests(): void {
  cached = null;
}
