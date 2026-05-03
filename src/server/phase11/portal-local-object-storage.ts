import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  assertSafePortalStorageKey,
  type PortalObjectStorage,
  type PortalPutObjectParams,
} from "@/server/phase11/portal-object-storage";

/**
 * Filesystem-backed private storage (development / self-hosted). Objects live under a single root directory.
 */
export class PortalLocalObjectStorage implements PortalObjectStorage {
  constructor(private readonly rootDir: string) {}

  private resolvePath(key: string): string {
    assertSafePortalStorageKey(key);
    const rootResolved = path.resolve(this.rootDir);
    const resolved = path.resolve(rootResolved, ...key.split("/").filter(Boolean));
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new Error("Storage path escaped root directory.");
    }
    return resolved;
  }

  async putObject(params: PortalPutObjectParams): Promise<void> {
    const target = this.resolvePath(params.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, params.body);
  }

  async getObjectStream(key: string): Promise<Readable> {
    const target = this.resolvePath(key);
    return createReadStream(target);
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolvePath(key);
    await fs.unlink(target).catch(() => undefined);
  }
}
