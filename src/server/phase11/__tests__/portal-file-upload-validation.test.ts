import { describe, expect, it } from "vitest";

import { sniffContentMime } from "@/server/phase11/portal-file-magic";
import {
  PortalFileUploadValidationError,
  validatePortalUploadBatch,
  validatePortalUploadPart,
} from "@/server/phase11/portal-file-upload-validation";

/** Tiny valid JPEG (1×1). */
const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF_BYTES = Buffer.from(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf-8",
);

describe("sniffContentMime", () => {
  it("detects jpeg, png, pdf", () => {
    expect(sniffContentMime(JPEG_BYTES)).toBe("image/jpeg");
    expect(sniffContentMime(PNG_BYTES)).toBe("image/png");
    expect(sniffContentMime(PDF_BYTES)).toBe("application/pdf");
  });
});

describe("validatePortalUploadPart", () => {
  it("accepts jpeg with matching extension and declared type", () => {
    const r = validatePortalUploadPart({
      originalFilename: "panel.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });
    expect(r.detectedContentType).toBe("image/jpeg");
    expect(r.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts octet-stream when magic matches", () => {
    const r = validatePortalUploadPart({
      originalFilename: "photo.jpeg",
      declaredContentType: "application/octet-stream",
      buffer: JPEG_BYTES,
    });
    expect(r.contentType).toBe("image/jpeg");
  });

  it("rejects declared type vs magic mismatch", () => {
    expect(() =>
      validatePortalUploadPart({
        originalFilename: "x.jpg",
        declaredContentType: "image/png",
        buffer: JPEG_BYTES,
      }),
    ).toThrow(PortalFileUploadValidationError);
  });

  it("rejects extension vs magic mismatch", () => {
    expect(() =>
      validatePortalUploadPart({
        originalFilename: "x.png",
        declaredContentType: "image/png",
        buffer: JPEG_BYTES,
      }),
    ).toThrow(PortalFileUploadValidationError);
  });

  it("rejects disallowed extension", () => {
    expect(() =>
      validatePortalUploadPart({
        originalFilename: "x.exe",
        declaredContentType: "application/octet-stream",
        buffer: JPEG_BYTES,
      }),
    ).toThrow(PortalFileUploadValidationError);
  });

  it("rejects empty file", () => {
    expect(() =>
      validatePortalUploadPart({
        originalFilename: "x.jpg",
        declaredContentType: "image/jpeg",
        buffer: Buffer.alloc(0),
      }),
    ).toThrow(PortalFileUploadValidationError);
  });
});

describe("validatePortalUploadBatch", () => {
  it("rejects empty batch", () => {
    expect(() => validatePortalUploadBatch([])).toThrow(PortalFileUploadValidationError);
  });

  it("rejects too many files", () => {
    const p = validatePortalUploadPart({
      originalFilename: "a.jpg",
      declaredContentType: "image/jpeg",
      buffer: JPEG_BYTES,
    });
    const many = Array.from({ length: 6 }, () => p);
    expect(() => validatePortalUploadBatch(many)).toThrow(PortalFileUploadValidationError);
  });
});
