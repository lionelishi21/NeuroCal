"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOptionalAuth } from "../auth/AuthProvider";
import { FocusRing } from "../components/FocusRing";
import { Logo } from "../components/Logo";
import { clearSessionHint } from "../lib/sessionHint";

const primary = "inline-flex h-14 items-center justify-center rounded-pill bg-synapse px-7 text-lg font-bold text-on-accent no-underline shadow-action hover:brightness-110";

/** The sample day the page describes. Fixed numbers, shown as a sample, never as the visitor's own. */
const SAMPLE_SCORE = 74;
const SIGNALS = [
  { name: "Sleep", word: "Good", detail: "7h 12m last night", value: 0.82, good: true },
  { name: "Evening timing", word: "Late", detail: "Dinner at 22:40", value: 0.45, good: false },
  { name: "Glycemic load", word: "Medium", detail: "Yesterday's food", value: 0.6, good: false },
  { name: "Stress", word: "Low", detail: "2 check-ins", value: 0.8, good: true },
] as const;

/** A day in order, by the clock: the page's one real sequence. */
const DAY = [
  { time: "07:10", title: "Your Focus Score is ready", body: "Last night's sleep, how late you ate, yesterday's food and your stress, as one number out of 100, with a sentence on what is moving it." },
  { time: "13:05", title: "Photograph lunch", body: "NeuroCal finds each item, its portion, calories and glycemic load. Untick anything it got wrong, or type an item in." },
  { time: "15:30", title: "Say how you feel", body: "Sharp, foggy, wired, calm: one tap. It changes what gets suggested next." },
  { time: "16:00", title: "See what to eat next", body: "A recipe that fits your diet, the calories you have left and the day you are having, with the reason it fits." },
  { time: "22:00", title: "Close the evening", body: "Log sleep and late screens. Tomorrow morning's score starts here." },
] as const;

/** The score's four inputs and their share of it (ARCHITECTURE §6.8). */
const PARTS = [
  { name: "Sleep", share: 40, fill: "bg-sleep", reads: "How long you slept last night." },
  { name: "Evening timing", share: 20, fill: "bg-synapse", reads: "How late you ate, and screens after 22:00." },
  { name: "Glycemic load", share: 20, fill: "bg-glucose", reads: "How much of yesterday's food spikes blood sugar." },
  { name: "Stress", share: 20, fill: "bg-chlorophyll-bar", reads: "What you said in your recent check-ins." },
] as const;

/**
 * What a signed-out visitor sees at the home page: what NeuroCal does, a sample of the Focus
 * Score, a day in order, and how to start. The app itself is behind "Sign in".
 */
export function Landing() {
  const auth = useOptionalAuth();
  // Once we know there is no session, drop the hint that hid this page for returning users.
  useEffect(() => {
    if (auth?.status === "signedOut") clearSessionHint();
  }, [auth?.status]);

  // The ring fills once, on arrival: the page's one moving part.
  const [score, setScore] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setScore(SAMPLE_SCORE), 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div data-landing className="mx-auto w-full max-w-[68rem] px-5 pb-16 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <Link href="/sign-in" className="flex h-11 items-center rounded-pill px-4 text-sm font-bold text-synapse-ink no-underline hover:bg-synapse-soft">
          Sign in
        </Link>
      </header>

      <main>
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:pt-14">
          <div>
            <h1 className="m-0 max-w-[14ch] text-3xl leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-display">Eat for how you want to think.</h1>
            <p className="mt-5 mb-0 max-w-[34rem] text-lg leading-[1.5] text-pretty text-ink-soft">
              Photograph your meals. NeuroCal reads them against your sleep and stress, gives you one Focus Score each morning and tells you what to eat next.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/sign-up" className={primary}>
                Create an account
              </Link>
              <Link href="/intro" className="text-md font-bold text-synapse-ink underline-offset-4 hover:underline">
                See how it works
              </Link>
            </div>
            <p className="mt-4 mb-0 text-sm text-ink-soft">Runs in your browser today. iPhone and Android apps are on the way.</p>
          </div>

          <figure className="m-0 mx-auto w-full max-w-[26rem]">
            <div className="rounded-hero border border-rule bg-paper p-[1.125rem]">
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
                <FocusRing score={score} size={104} stroke={18}>
                  <span className="text-3xl leading-none font-extrabold tracking-[-0.03em] tabular-nums">{SAMPLE_SCORE}</span>
                  <span className="mt-[3px] text-3xs font-medium text-ink-soft">of 100</span>
                </FocusRing>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="m-0 text-xs font-semibold text-synapse-ink">Focus Score</p>
                  <p className="m-0 text-xl leading-[1.15] font-extrabold">Good</p>
                  <p className="m-0 text-sm text-pretty text-ink-soft">Solid sleep and low stress are carrying you. Last night's 22:40 dinner is the biggest drag, so expect a dip near 16:00.</p>
                </div>
              </div>
              <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2 p-0">
                {SIGNALS.map((signal) => (
                  <li key={signal.name} className="flex flex-col gap-1 rounded-option bg-mist px-3 py-2.5">
                    <span className="text-2xs font-semibold text-ink-soft">{signal.name}</span>
                    <span className={`text-md font-bold ${signal.good ? "text-chlorophyll" : "text-glucose-ink"}`}>{signal.word}</span>
                    <span aria-hidden className="block h-1 rounded-pill bg-track">
                      <span className={`block h-full rounded-pill ${signal.good ? "bg-chlorophyll-bar" : "bg-glucose"}`} style={{ width: `${signal.value * 100}%` }} />
                    </span>
                    <span className="text-2xs text-ink-faint">{signal.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="mt-2.5 text-center text-xs text-ink-soft">A sample morning. Yours comes from what you log.</figcaption>
          </figure>
        </section>

        <section aria-labelledby="day-title" className="mt-20 max-w-[44rem] lg:mt-28">
          <h2 id="day-title" className="m-0 text-2xl font-extrabold tracking-[-0.02em]">
            A day with NeuroCal
          </h2>
          <ol className="m-0 mt-7 list-none p-0">
            {DAY.map((step, i) => (
              <li key={step.time} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4">
                <time className="pt-0.5 text-sm font-bold text-synapse-ink tabular-nums">{step.time}</time>
                <div className={`relative border-l pl-6 ${i === DAY.length - 1 ? "border-transparent" : "border-rule-strong pb-8"}`}>
                  <span aria-hidden className="absolute top-1.5 -left-[5px] size-[9px] rounded-full bg-synapse ring-4 ring-mist" />
                  <h3 className="m-0 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 mb-0 text-md text-pretty text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="score-title" className="mt-20 max-w-[44rem] lg:mt-28">
          <h2 id="score-title" className="m-0 text-2xl font-extrabold tracking-[-0.02em]">
            What the score is made of
          </h2>
          <p className="mt-3 mb-0 text-md text-pretty text-ink-soft">
            A fixed formula, not a guess. Four things you can change, weighted the same way every day. The sentence beside the score is written by AI from those four numbers and nothing else.
          </p>
          <div aria-hidden className="mt-6 flex h-3 gap-[3px]">
            {PARTS.map((part) => (
              <span key={part.name} className={`rounded-[3px] ${part.fill}`} style={{ flex: `${part.share} 0 0` }} />
            ))}
          </div>
          <dl className="m-0 mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {PARTS.map((part) => (
              <div key={part.name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
                <span aria-hidden className={`mt-[0.4375rem] size-2.5 rounded-full ${part.fill}`} />
                <dt className="text-md font-bold">
                  {part.name} <span className="font-semibold text-ink-soft">{part.share}%</span>
                </dt>
                <dd className="col-start-2 m-0 text-sm text-ink-soft">{part.reads}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="straight-title" className="mt-20 max-w-[44rem] lg:mt-28">
          <h2 id="straight-title" className="m-0 text-2xl font-extrabold tracking-[-0.02em]">
            Three things to know first
          </h2>
          <ul className="m-0 mt-5 flex list-none flex-col gap-4 p-0 text-md text-pretty">
            <li>
              <b className="font-bold">It is not medical advice.</b> <span className="text-ink-soft">NeuroCal shows patterns in what you log. It does not diagnose or treat anything.</span>
            </li>
            <li>
              <b className="font-bold">Suggestions come from your week.</b> <span className="text-ink-soft">Routines and products are matched to the parts of your score that were weakest.</span>
            </li>
            <li>
              <b className="font-bold">Paid links are labelled.</b>{" "}
              <span className="text-ink-soft">A product we earn a commission on says "Affiliate link". One sold by MitoProof, which is run by the people who make NeuroCal, says "Our brand".</span>
            </li>
          </ul>
        </section>

        <section className="mt-20 flex flex-col items-start gap-5 rounded-hero border border-rule bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:mt-28">
          <div>
            <h2 className="m-0 text-xl font-extrabold tracking-[-0.015em]">Start with tonight's sleep.</h2>
            <p className="mt-1 mb-0 text-md text-ink-soft">Log it tomorrow morning and you have a first score.</p>
          </div>
          <Link href="/sign-up" className={`${primary} shrink-0`}>
            Create an account
          </Link>
        </section>
      </main>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6 text-sm text-ink-soft">
        <span>NeuroCal</span>
        <Link href="/sign-in" className="font-bold text-synapse-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </footer>
    </div>
  );
}
