"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAuthHooks } from "../api/client";
import { introSeen } from "../lib/intro";
import { createMockAuth } from "./mockAuth";
import type { AuthClient, AuthUser } from "./types";

const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

/** Cognito when the stage's pool is configured; otherwise the local mock (Amplify is never loaded). */
async function defaultClient(): Promise<AuthClient> {
  if (POOL_ID && CLIENT_ID) {
    const { createCognitoAuth } = await import("./cognitoAuth");
    return createCognitoAuth({ userPoolId: POOL_ID, userPoolClientId: CLIENT_ID });
  }
  return createMockAuth();
}

export const usesMockAuth = !(POOL_ID && CLIENT_ID);

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  client: AuthClient | null;
  /** Re-reads the current user, e.g. after signing in. */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** For components that also render outside the provider (e.g. screens in unit tests). */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth needs an AuthProvider.");
  return state;
}

export function AuthProvider({ children, client: injected }: { children: ReactNode; client?: AuthClient }) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState<AuthClient | null>(injected ?? null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!client) void defaultClient().then(setClient);
  }, [client]);

  const refresh = useCallback(async () => {
    if (!client) return;
    const current = await client.currentUser();
    setUser(current);
    setStatus(current ? "signedIn" : "signedOut");
  }, [client]);

  useEffect(() => {
    if (!client) return;
    // Every API call carries the ID token; a 401 means the session is gone.
    setAuthHooks({
      token: () => client.idToken(),
      onUnauthorized: () => {
        setUser(null);
        setStatus("signedOut");
      },
    });
    void refresh();
    return () => setAuthHooks(null);
  }, [client, refresh]);

  const signOut = useCallback(async () => {
    await client?.signOut();
    queryClient.clear();
    setUser(null);
    setStatus("signedOut");
  }, [client, queryClient]);

  const value = useMemo(() => ({ status, user, client, refresh, signOut }), [status, user, client, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The lab shows component states with fixed sample data: no account or API involved.
const PUBLIC_PATHS = ["/intro", "/sign-in", "/sign-up", "/lab"];

/**
 * Sends signed-out visitors to sign-in (remembering where they were going); renders nothing until the
 * session is known. With `landing`, the home page shows that to anyone not signed in instead of redirecting.
 */
export function RequireAuth({ children, landing }: { children: ReactNode; landing?: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const showsLanding = landing !== undefined && pathname === "/";

  useEffect(() => {
    if (!isPublic && !showsLanding && status === "signedOut") {
      // A first visit starts with the intro; after that, straight to sign in.
      if (pathname === "/" && !introSeen()) router.replace("/intro");
      else router.replace(pathname === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublic, showsLanding, status, pathname, router]);

  if (isPublic) return children;
  // Shown while the session is still being checked too, so the server can render it.
  if (showsLanding && status !== "signedIn") return landing;
  return status === "signedIn" ? children : null;
}

/** Where to go after signing in: the `next` query value if it is a same-site path. */
export function nextPath(search: string = typeof window === "undefined" ? "" : window.location.search): string {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
