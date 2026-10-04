"use client";

import { useOptionalAuth } from "../auth/AuthProvider";
import { useToast } from "./Toast";

/** "Sign out" on the Settings screen. Renders nothing outside an AuthProvider. */
export function SignOutLink() {
  const auth = useOptionalAuth();
  const toast = useToast();
  if (!auth) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await auth.signOut();
        toast("Signed out");
      }}
      className="cursor-pointer bg-transparent p-0 text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
    >
      Sign out
    </button>
  );
}
