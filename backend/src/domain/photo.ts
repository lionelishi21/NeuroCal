/** The largest meal photo accepted, by upload or in a request body. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Every uploaded photo's key starts with its owner, so a key can be checked against the caller. */
export const photoPrefixFor = (userId: string) => `uploads/${userId}/`;
const prefix = photoPrefixFor;

export const photoKeyFor = (userId: string, id: string) => `${prefix(userId)}${id}`;

export const ownsPhotoKey = (userId: string, key: string) => key.startsWith(prefix(userId)) && !key.includes("..");

/**
 * The image type from a file's first bytes, or null when it isn't a JPEG, PNG, WebP or GIF. Some
 * clients (Flutter's multipart upload) label every file application/octet-stream.
 */
export function imageTypeOf(bytes: Uint8Array): string | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  return null;
}
