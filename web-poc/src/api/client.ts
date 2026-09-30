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

interface AuthHooks {
  token(): Promise<string | null>;
  onUnauthorized(): void;
}

let auth: AuthHooks | null = null;

/** Set by the AuthProvider: where the ID token comes from and what a 401 does. */
export function setAuthHooks(hooks: AuthHooks | null) {
  auth = hooks;
}

/** Fetches from the API and validates the response against its contract schema. */
export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const token = await auth?.token();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (response.status === 401) auth?.onUnauthorized();
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
