/** Typed failures that presentation/ maps to HTTP status codes (ARCHITECTURE §6). */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** → 400 */
export class InvalidError extends DomainError {
  readonly code = "invalid_request";
}

/** → 404. Also used for another user's resources, so they are indistinguishable from missing ones. */
export class NotFoundError extends DomainError {
  readonly code = "not_found";
}

/** → 403. Signed in, but not allowed to do this. */
export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
}

/** → 502. A model or external service failed or returned something unusable. */
export class UpstreamError extends DomainError {
  readonly code = "upstream_failed";
}
