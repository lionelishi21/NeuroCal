"use client";

import { type FormEvent, useId, useState } from "react";
import type { JoinWaitlistRequest } from "@neurocal/contracts";
import { RequestFailed } from "../api/client";
import { useJoinWaitlist } from "../api/queries";
import { Spinner } from "./Spinner";

const PLATFORMS = [
  ["iphone", "iPhone"],
  ["android", "Android"],
] as const;
type Platform = NonNullable<JoinWaitlistRequest["platform"]>;

/**
 * The landing page's sign-up for the mobile app: an email address, optionally which phone, and
 * one button. Sits on the violet closing banner, so its colours are the banner's.
 */
export function WaitlistForm() {
  const emailId = useId();
  const noteId = useId();
  const join = useJoinWaitlist();
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<Platform>();
  const [missing, setMissing] = useState(false);

  if (join.isSuccess) {
    return (
      <div role="status" className="flex w-full max-w-[30rem] flex-col items-center gap-1.5 rounded-card bg-on-promo/15 px-6 py-5">
        <p className="m-0 text-xl font-extrabold">You're on the list</p>
        <p className="m-0 text-md text-pretty text-on-promo-soft">We'll email {email.trim()} the day NeuroCal is ready to download.</p>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setMissing(true);
    join.mutate({ email: address, ...(platform ? { platform } : {}) });
  };

  const problem = missing
    ? "Enter your email address, like name@example.com."
    : join.isError
      ? join.error instanceof RequestFailed && join.error.status === 400
        ? "That email address doesn't look right. Check it and try again."
        : join.error instanceof RequestFailed && join.error.status === 429
          ? "Lots of people are signing up right now. Try again in a minute."
          : "Couldn't add you to the list. Check your connection and try again."
      : null;

  return (
    <form onSubmit={submit} noValidate aria-label="Get the app" className="flex w-full max-w-[30rem] flex-col items-stretch gap-3">
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMissing(false);
            if (join.isError) join.reset();
          }}
          aria-invalid={problem !== null}
          aria-describedby={noteId}
          className="h-[3.625rem] w-full min-w-0 shrink-0 rounded-pill sm:w-auto sm:flex-1 sm:shrink border-2 border-transparent bg-on-promo px-6 text-base text-promo-deep placeholder:text-promo/60 focus:border-promo-spark focus:outline-none"
        />
        <button
          type="submit"
          disabled={join.isPending}
          className="flex h-[3.625rem] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill bg-promo-deep px-7 text-base font-extrabold text-on-promo ring-2 ring-on-promo/40 ring-inset hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {join.isPending && <Spinner className="size-4" />}
          {join.isPending ? "Adding you…" : "Tell me when it's ready"}
        </button>
      </div>
      <fieldset className="m-0 flex min-w-0 flex-wrap items-center justify-center gap-2 border-0 p-0">
        <legend className="float-left mr-1 p-0 text-sm text-on-promo-soft">Which phone? (optional)</legend>
        {PLATFORMS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={platform === value}
            onClick={() => setPlatform(platform === value ? undefined : value)}
            className={`h-9 cursor-pointer rounded-pill px-4 text-sm font-bold ${platform === value ? "bg-on-promo text-promo" : "bg-on-promo/15 text-on-promo hover:bg-on-promo/25"}`}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <p id={noteId} aria-live="polite" className={`m-0 text-sm ${problem ? "font-bold text-on-promo" : "text-on-promo-soft"}`}>
        {problem ?? "We'll confirm by email, then write once more when the app is ready. Unsubscribe any time."}
      </p>
    </form>
  );
}
