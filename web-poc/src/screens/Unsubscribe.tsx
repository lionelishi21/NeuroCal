"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLeaveWaitlist } from "../api/queries";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";

/**
 * Where the unsubscribe link in a waitlist email lands. Leaving takes one click here, not just
 * opening the link: mail scanners open links, and they shouldn't take people off the list.
 */
export function Unsubscribe() {
  const leave = useLeaveWaitlist();
  // Read after mount: the token is in the address, which the server render doesn't see.
  const [token, setToken] = useState<string | null>();
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token")), []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-6 py-10">
      <Logo />
      {leave.isSuccess ? (
        <>
          <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">You're off the list</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">We won't email you about the app. You can join again from the home page whenever you like.</p>
        </>
      ) : token === null || (token !== undefined && token.length < 16) ? (
        <>
          <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">This link isn't complete</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">Open the unsubscribe link from the email again; part of it is missing here.</p>
        </>
      ) : (
        <>
          <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">Leave the NeuroCal list?</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">You asked to be emailed when the app is ready. Unsubscribe and we won't email you about it.</p>
          {leave.isError && <ErrorPanel title="Couldn't unsubscribe you.">Check your connection and try again.</ErrorPanel>}
          <Button className="mt-7 w-full" disabled={!token || leave.isPending} onClick={() => token && leave.mutate(token)}>
            {leave.isPending && <Spinner />}
            {leave.isPending ? "Unsubscribing…" : "Unsubscribe"}
          </Button>
        </>
      )}
      <Link href="/" className="mt-5 self-center text-md font-bold text-synapse-ink underline-offset-4 hover:underline">
        Back to the home page
      </Link>
    </main>
  );
}
