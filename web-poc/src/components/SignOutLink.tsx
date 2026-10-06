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
        toast("Signed out", "info");
      }}
      className="h-11 shrink-0 cursor-pointer rounded-pill bg-beet-soft px-4 text-sm font-bold text-beet hover:brightness-95"
    >
      Sign out
    </button>
  );
}
