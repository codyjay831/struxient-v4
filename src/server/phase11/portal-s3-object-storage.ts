import { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  assertSafePortalStorageKey,
  type PortalObjectStorage,
  type PortalPutObjectParams,
} from "@/server/phase11/portal-object-storage";

/** Private S3-compatible object storage for production portal uploads. */
export class PortalS3ObjectStorage implements PortalObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async putObject(params: PortalPutObjectParams): Promise<void> {
    assertSafePortalStorageKey(params.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async getObjectStream(key: string): Promise<Readable> {
    assertSafePortalStorageKey(key);
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    const body = out.Body;
    if (!body) {
      throw new Error("S3 object body missing.");
    }
    return body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    assertSafePortalStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
