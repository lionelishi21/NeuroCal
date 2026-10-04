import { GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { IObjectStorage } from "../../application/interfaces/IObjectStorage";

const UPLOAD_SECONDS = 300;

/** Meal photos in the stack's private bucket (ARCHITECTURE §10): presigned PUT in, read by key. */
export class S3ObjectStorage implements IObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: { bucket: string; client?: S3Client }) {
    this.client = options.client ?? new S3Client({});
  }

  async createUploadUrl(key: string, mediaType: string, sizeBytes: number) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.options.bucket, Key: key, ContentType: mediaType, ContentLength: sizeBytes }),
      // Signing both headers makes S3 refuse a different type or size than the one that was approved.
      { expiresIn: UPLOAD_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return { url, headers: { "content-type": mediaType }, expiresAt: new Date(Date.now() + UPLOAD_SECONDS * 1000) };
  }

  async read(key: string, maxBytes: number) {
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
      if (!object.Body || (object.ContentLength ?? 0) > maxBytes) return null;
      return { bytes: await object.Body.transformToByteArray(), mediaType: object.ContentType ?? "application/octet-stream" };
    } catch (error) {
      // AccessDenied is what S3 answers for a missing key when the caller can't list the bucket.
      if (error instanceof S3ServiceException && ["NoSuchKey", "AccessDenied"].includes(error.name)) return null;
      throw error;
    }
  }
}
