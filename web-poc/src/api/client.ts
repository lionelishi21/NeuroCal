import type { z } from "zod";
import { ApiError } from "@neurocal/contracts";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export class RequestFailed extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fetches from the API and validates the response against its contract schema. */
export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json", ...init.headers }
        : init?.headers,
  });
  const body: unknown = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    const error = ApiError.safeParse(body);
    throw new RequestFailed(
      response.status,
      error.success ? error.data.code : "unknown",
      error.success ? error.data.message : `Request to ${path} failed with ${response.status}.`,
    );
  }
  return schema.parse(body);
}
