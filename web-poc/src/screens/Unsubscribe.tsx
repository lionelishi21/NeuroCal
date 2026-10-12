"use client";

import { useEffect, useState } from "react";
import { useLeaveWaitlist } from "../api/queries";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { SiteFrame } from "../components/SiteFrame";
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
    <SiteFrame>
      {leave.isSuccess ? (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">You're off the list</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">We won't email you about the app. You can join again from the home page whenever you like.</p>
        </>
      ) : token === null || (token !== undefined && token.length < 16) ? (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">This link isn't complete</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">Open the unsubscribe link from the email again; part of it is missing here.</p>
        </>
      ) : (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">Leave the NeuroCal list?</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">You asked to be emailed when the app is ready. Unsubscribe and we won't email you about it.</p>
          {leave.isError && <ErrorPanel title="Couldn't unsubscribe you.">Check your connection and try again.</ErrorPanel>}
          <Button className="mt-7 w-full" disabled={!token || leave.isPending} onClick={() => token && leave.mutate(token)}>
            {leave.isPending && <Spinner />}
            {leave.isPending ? "Unsubscribing…" : "Unsubscribe"}
          </Button>
        </>
      )}
    </SiteFrame>
  );
}
