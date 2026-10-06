/** The largest meal photo accepted, by upload or in a request body. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Every uploaded photo's key starts with its owner, so a key can be checked against the caller. */
const prefix = (userId: string) => `uploads/${userId}/`;

export const photoKeyFor = (userId: string, id: string) => `${prefix(userId)}${id}`;

export const ownsPhotoKey = (userId: string, key: string) => key.startsWith(prefix(userId)) && !key.includes("..");
