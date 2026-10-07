"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RequestFailed } from "../api/client";
import { useAdminProducts } from "../api/queries";
import { ScreenFailed } from "../components/ListStates";
import { Logo } from "../components/Logo";
import { useAuth } from "./AuthProvider";

/**
 * The web app is for admins: NeuroCal's product is the mobile app, and the website is its landing
 * page. Anyone else who signs in here is told so and offered the way out. Whether someone is an
 * admin is the API's call (it refuses the product list to everyone else), not this screen's.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const signedIn = auth.status === "signedIn";
  const admin = useAdminProducts(signedIn);

  // Signed-out pages (sign in, the landing page) are not this gate's business.
  if (!signedIn) return children;
  if (admin.isPending) return null;
  if (admin.isSuccess) return children;

  const refused = admin.error instanceof RequestFailed && admin.error.status === 403;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-6 py-10">
      <Logo />
      {refused ? (
        <>
          <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">NeuroCal lives on your phone.</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">
            The web app is for the NeuroCal team. {auth.user?.email ? `${auth.user.email} isn't an admin account.` : "This isn't an admin account."} Your meals and scores are in the mobile app.
          </p>
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="mt-7 h-14 cursor-pointer rounded-pill bg-synapse px-7 text-lg font-bold text-on-accent hover:brightness-110"
          >
            Sign out
          </button>
          <Link href="/" className="mt-4 self-center text-md font-bold text-synapse-ink underline-offset-4 hover:underline" onClick={() => auth.signOut()}>
            Back to the home page
          </Link>
        </>
      ) : (
        <div className="-mx-4 mt-4">
          <ScreenFailed title="Couldn't check your account" onRetry={() => admin.refetch()}>
            Check your connection and try again.
          </ScreenFailed>
        </div>
      )}
    </main>
  );
}
