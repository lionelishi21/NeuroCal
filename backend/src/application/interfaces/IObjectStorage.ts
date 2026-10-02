/** Private storage for meal photos (ARCHITECTURE §5). Keys are never public URLs. */
export interface IObjectStorage {
  /**
   * A short-lived URL the client can PUT exactly `sizeBytes` of `mediaType` to,
   * with the headers the PUT must carry.
   */
  createUploadUrl(key: string, mediaType: string, sizeBytes: number): Promise<{ url: string; headers: Record<string, string>; expiresAt: Date }>;
  /** The object, or null when nothing was uploaded under the key. Refuses objects over `maxBytes`. */
  read(key: string, maxBytes: number): Promise<{ bytes: Uint8Array; mediaType: string } | null>;
}
