import type { IObjectStorage } from "../../application/interfaces/IObjectStorage";

/**
 * In-memory stand-in for S3 on the dev server. Upload URLs point back at the
 * dev server, which hands the bytes to `put`. Like S3 with a signed
 * content-length, it refuses bytes that don't match what the URL was made for.
 */
export class DevObjectStorage implements IObjectStorage {
  static readonly PATH = "/_uploads/";
  private readonly expected = new Map<string, { mediaType: string; sizeBytes: number }>();
  private readonly objects = new Map<string, { bytes: Uint8Array; mediaType: string }>();

  constructor(private readonly baseUrl: string) {}

  async createUploadUrl(key: string, mediaType: string, sizeBytes: number) {
    this.expected.set(key, { mediaType, sizeBytes });
    return {
      url: `${this.baseUrl}${DevObjectStorage.PATH}${encodeURIComponent(key)}`,
      headers: { "content-type": mediaType },
      expiresAt: new Date(Date.now() + 5 * 60_000),
    };
  }

  /** True when the bytes were expected and stored. */
  put(key: string, bytes: Uint8Array, mediaType: string | undefined): boolean {
    const expected = this.expected.get(key);
    if (!expected || expected.sizeBytes !== bytes.byteLength || expected.mediaType !== mediaType) return false;
    this.objects.set(key, { bytes, mediaType: expected.mediaType });
    return true;
  }

  async read(key: string, maxBytes: number) {
    const found = this.objects.get(key);
    return found && found.bytes.byteLength <= maxBytes ? found : null;
  }
}
