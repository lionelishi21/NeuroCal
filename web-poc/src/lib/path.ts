"use client";

import { usePathname } from "next/navigation";

/** A path without its trailing slash ("/sign-in/" → "/sign-in"); the root stays "/". */
export const withoutTrailingSlash = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

/**
 * The current path, the same whether or not it ends in "/". The deployed site is built with
 * trailing slashes (each page is a folder's index.html), the dev server without.
 */
export function usePath(): string {
  return withoutTrailingSlash(usePathname() ?? "/");
}
