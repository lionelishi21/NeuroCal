"use client";

import { useEffect, useState } from "react";
import { useLeaveWaitlist, useStopEmail } from "../api/queries";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { SiteFrame } from "../components/SiteFrame";
import { Spinner } from "../components/Spinner";

const COPY = {
  waitlist: {
    done: "You're off the list",
    doneText: "We won't email you about the app. You can join again from the home page whenever you like.",
    ask: "Leave the NeuroCal list?",
    askText: "You asked to be emailed when the app is ready. Unsubscribe and we won't email you about it.",
    button: "Unsubscribe",
  },
  weekly: {
    done: "No more weekly emails",
    doneText: "Your report is still in the app every Monday. Turn the email back on under Me > Notifications.",
    ask: "Stop the weekly report email?",
    askText: "Every Monday we email how last week went. Stop it and the report stays in the app.",
    button: "Stop these emails",
  },
  comeBack: {
    done: "No more of these emails",
    doneText: "We won't email you when you've been away. Turn it back on under Me > Notifications.",
    ask: "Stop emails after time away?",
    askText: "After a week away we send one email with a way back in. Stop it and we won't.",
    button: "Stop these emails",
  },
};

type From = keyof typeof COPY;

/**
 * Where the unsubscribe links in a waitlist email, the weekly report email (`from=weekly`) and the
 * email after a week away (`from=comeBack`) land.
 * Leaving takes one click here, not just opening the link: mail scanners open links, and they
 * shouldn't unsubscribe anyone.
 */
export function Unsubscribe() {
  const waitlist = useLeaveWaitlist();
  const email = useStopEmail();
  // Read after mount: the token is in the address, which the server render doesn't see.
  const [token, setToken] = useState<string | null>();
  const [from, setFrom] = useState<From>("waitlist");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setToken(query.get("token"));
    const asked = query.get("from");
    if (asked === "weekly" || asked === "comeBack") setFrom(asked);
  }, []);
  const leave = from === "waitlist" ? waitlist : email;
  const copy = COPY[from];

  return (
    <SiteFrame>
      {leave.isSuccess ? (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">{copy.done}</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">{copy.doneText}</p>
        </>
      ) : token === null || (token !== undefined && token.length < 16) ? (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">This link isn't complete</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">Open the unsubscribe link from the email again; part of it is missing here.</p>
        </>
      ) : (
        <>
          <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">{copy.ask}</h1>
          <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">{copy.askText}</p>
          {leave.isError && <ErrorPanel title="Couldn't unsubscribe you.">Check your connection and try again.</ErrorPanel>}
          <Button className="mt-7 w-full" disabled={!token || leave.isPending} onClick={() => {
              if (!token) return;
              if (from === "waitlist") waitlist.mutate(token);
              else email.mutate({ token, from });
            }}>
            {leave.isPending && <Spinner />}
            {leave.isPending ? "Unsubscribing…" : copy.button}
          </Button>
        </>
      )}
    </SiteFrame>
  );
}
