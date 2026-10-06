"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useOptionalAuth } from "../auth/AuthProvider";
import { FocusDemo } from "../components/FocusDemo";
import { FocusRing } from "../components/FocusRing";
import { LogoMark } from "../components/Logo";
import { clearSessionHint } from "../lib/sessionHint";

const wrap = "mx-auto w-full max-w-[73.75rem] px-6";
const eyebrow = "m-0 text-sm font-bold text-ion-ink";
const heading = "m-0 text-heading leading-[1.08] font-extrabold tracking-[-0.03em] text-balance";
const arrow = (
  <svg viewBox="0 0 24 24" aria-hidden className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const tick = (className: string) => (
  <svg viewBox="0 0 24 24" aria-hidden className={`size-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const NAV = [
  ["#how", "How it works"],
  ["#score", "Focus Score"],
  ["#science", "Science"],
  ["#pricing", "Pricing"],
] as const;

const STEPS = [
  {
    title: "Snap",
    body: "Photograph your plate. NeuroCal finds each item and its portion, calories and glycemic load.",
    rows: [
      ["Chicken wrap", "610 kcal", "text-ink"],
      ["Glycemic load", "High", "text-glucose-ink"],
    ],
  },
  {
    title: "Score",
    body: "Each morning, your meals, sleep and check-ins become one Focus Score with a plain explanation.",
    rows: [
      ["Focus Score", "74 · Good", "text-synapse-ink"],
      ["Biggest drag", "Late dinner", "text-glucose-ink"],
    ],
  },
  {
    title: "Adjust",
    body: "Get one meal suggestion that fits what you have left, plus routines when a pattern shows up.",
    rows: [
      ["Next meal", "Salmon, quinoa", "text-ink"],
      ["Why", "Steadier at 16:00", "text-ion-ink"],
    ],
  },
] as const;

const INPUTS = [
  { title: "Sleep", body: "How long you slept last night, from a quick log each morning.", icon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z", tile: "bg-synapse-soft text-synapse-ink" },
  { title: "Evening timing", body: "How close your last meal was to bedtime. Late dinners tend to cost sleep quality.", icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", tile: "bg-glucose-soft text-glucose-ink" },
  { title: "Glycemic load", body: "How sharply yesterday's food was likely to swing your blood sugar.", icon: "M3 17l5-6 4 3 4-7 5 6", tile: "bg-ion-soft text-ion-ink" },
  { title: "Stress", body: "From your check-ins: sharp, foggy, wired, calm and so on.", icon: "M4 12h3l2-5 3 10 2-5h6", tile: "bg-beet-soft text-beet" },
] as const;

/** A sample week for the chart: night, bedtime, wake-up, last meal, minutes of screens after 22:00. */
const NIGHTS = [
  ["Fri", "23:40", "06:05", "21:50", 45],
  ["Sat", "00:30", "08:20", "20:30", 20],
  ["Sun", "01:10", "07:05", "23:10", 90],
  ["Mon", "23:20", "06:30", "20:05", 0],
  ["Tue", "22:50", "06:15", "19:40", 15],
  ["Wed", "00:40", "06:50", "22:40", 60],
  ["Thu", "23:10", "06:22", "22:40", 30],
] as const;
const AXIS_HOURS = 18;
/** Hours after 18:00 for a "HH:MM" time, wrapping past midnight. */
const fromSix = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const hours = (h ?? 0) + (m ?? 0) / 60;
  return hours >= 18 ? hours - 18 : hours + 6;
};
/** Rounded, so the server and the browser write the same style. */
const pct = (hours: number) => `${Math.round((hours / AXIS_HOURS) * 100000) / 1000}%`;
const TICKS = ["18", "21", "00", "03", "06", "09", "12"];

/** Not connected yet: shown so people know sync is coming. */
const WEARABLES = ["Oura", "Whoop", "Apple Health"] as const;

const SCIENCE = [
  ["One formula, the same every day", "Sleep counts for 40% of the score and the other three inputs for 20% each. Nothing is hidden or adjusted behind the scenes: try it in the demo above."],
  ["Four inputs, shown openly", "Sleep, evening timing, glycemic load and stress each feed the score. You'll always see which one lifted or lowered it."],
  ["Estimates, labelled as estimates", "Photo readings and glycemic load are estimates. When we're not sure, we say \"best guess\" and let you correct it."],
  ["Patterns over single days", "One late dinner is noise. Three in a week is a pattern, and that's when we suggest a routine."],
] as const;

const PRO_MONTHLY = 6;
const FREE = ["Photo meal logging", "Daily Focus Score with explanation", "Calories and macros", "Check-ins", "What to eat next"];
const PRO = ["This week: charts and weak points", "Sleep and evenings clock", "Routines with steps", "Oura, Whoop and Apple Health sync, when it arrives", "Unlimited history"];

const FAQS = [
  ["Do I need a wearable?", "No. You log bedtime and wake-up in a few seconds. Sync with Oura, Whoop and Apple Health is on the way."],
  ["How does photo logging work?", "Take a photo of your plate. We find each item and estimate the portion, calories and glycemic load. Anything we're unsure of is marked \"best guess\", and you can untick it or add items by hand."],
  ["Is it really free?", "Yes. Meal logging, the daily Focus Score, check-ins and meal suggestions are free for good. Weekly patterns, the sleep clock and routines will be part of Pro; until Pro launches they are free too."],
  ["What happens to my data?", "Your meals, sleep and check-ins are used only to work out your score and suggestions. We don't sell your data."],
  ["Why do you suggest products?", "Sometimes a product fits a weak spot in your week. Every suggestion is labelled \"Affiliate link\" or \"Our brand\", and we say clearly when we earn a commission."],
  ["When does Pro start?", "We're building it now. Everything listed under Pro is free for everyone while we do."],
] as const;

/**
 * What a signed-out visitor sees at the home page, from the Claude Design landing page:
 * hero with a phone, how it works, the Focus Score's inputs, the nights clock, wearables,
 * the science, pricing, questions and a closing banner. The app itself is behind "Sign in".
 */
export function Landing() {
  const auth = useOptionalAuth();
  // Once we know there is no session, drop the hint that hid this page for returning users.
  useEffect(() => {
    if (auth?.status === "signedOut") clearSessionHint();
  }, [auth?.status]);

  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);
  const faqId = useId();

  return (
    <div data-landing className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-10 border-b border-rule bg-mist/90 backdrop-blur-md">
        <div className={`${wrap} flex h-[4.25rem] items-center gap-6`}>
          <a href="#top" className="flex items-center gap-2 text-ink no-underline">
            <LogoMark className="size-7" />
            <span className="text-xl font-extrabold tracking-[-0.025em]">NeuroCal</span>
          </a>
          <nav aria-label="Sections" className="hidden flex-1 flex-wrap justify-center gap-1 md:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-soft no-underline hover:bg-track hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/sign-in" className="flex h-10 items-center px-3.5 text-sm font-bold text-ink no-underline hover:text-synapse-ink">
              Sign in
            </Link>
            <Link href="/sign-up" className="flex h-10 items-center rounded-pill bg-synapse px-[1.125rem] text-sm font-bold text-on-accent no-underline hover:brightness-110">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="top" className={`${wrap} flex flex-wrap items-center justify-center gap-14 pt-12 pb-16 sm:pt-[4.5rem] sm:pb-[5.5rem]`}>
          <div className="flex max-w-[35rem] flex-[1_1_27.5rem] flex-col gap-6">
            <p className="m-0 flex h-8 items-center gap-2 self-start rounded-pill bg-synapse-soft px-3.5 text-xs font-bold text-synapse-ink">
              <span aria-hidden className="size-[7px] rounded-full bg-ion" />
              Food, sleep and stress, read together
            </p>
            <h1 className="m-0 text-hero leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">Know why your afternoon falls apart.</h1>
            <p className="m-0 max-w-[31.25rem] text-lead leading-[1.55] text-pretty text-ink-soft">
              Snap your meals. NeuroCal reads them alongside last night's sleep and how you feel, then gives you one Focus Score and one thing to change.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className="flex h-14 items-center gap-2.5 rounded-pill bg-synapse px-7 text-base font-bold text-on-accent no-underline shadow-action hover:brightness-110">
                Start free
                {arrow}
              </Link>
              <a href="#how" className="flex h-14 items-center rounded-pill border-[1.5px] border-rule-strong px-[1.375rem] text-base font-bold text-ink no-underline hover:bg-paper">
                See how it works
              </a>
            </div>
            <p className="m-0 text-sm text-ink-soft">Free forever plan. No card needed. Works in your browser.</p>
          </div>
          <Phone />
        </section>

        <section id="how" className="scroll-mt-16 border-y border-rule bg-paper">
          <div className={`${wrap} py-16 sm:py-24`}>
            <div className="max-w-[40rem]">
              <p className={eyebrow}>How it works</p>
              <h2 className={`${heading} mt-2.5`}>Ten seconds a meal. One clear answer a day.</h2>
            </div>
            <ol className="m-0 mt-12 grid list-none grid-cols-[repeat(auto-fit,minmax(16.25rem,1fr))] gap-5 p-0">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3.5 rounded-hero bg-mist p-7">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid size-11 place-items-center rounded-option bg-synapse text-lg font-extrabold text-on-accent">
                      {i + 1}
                    </span>
                    <h3 className="m-0 text-xl font-extrabold tracking-[-0.02em]">{step.title}</h3>
                  </div>
                  <p className="m-0 text-base leading-[1.55] text-pretty text-ink-soft">{step.body}</p>
                  <dl className="m-0 mt-auto flex flex-col gap-2 rounded-control bg-paper p-3.5">
                    {step.rows.map(([name, value, ink]) => (
                      <div key={name} className="flex justify-between gap-2.5 text-sm">
                        <dt className="font-semibold">{name}</dt>
                        <dd className={`m-0 font-bold ${ink}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="score" className={`${wrap} flex scroll-mt-16 flex-wrap items-center gap-14 py-16 sm:py-[6.5rem]`}>
          <div className="flex flex-[1_1_23.75rem] flex-col gap-[1.125rem]">
            <p className={eyebrow}>The Focus Score</p>
            <h2 className={heading}>0 to 100. Four inputs. No mystery.</h2>
            <p className="m-0 max-w-[31.25rem] text-lg leading-[1.55] text-pretty text-ink-soft">
              Every morning you get a score and a sentence on what's helping and what's dragging. You'll always see which input moved it, so you know what to change.
            </p>
            <p className="m-0 max-w-[31.25rem] text-md leading-[1.55] text-ink-soft">No score yet? Log one night of sleep and one check-in. That's enough to start.</p>
          </div>
          <ul className="m-0 grid flex-[1_1_27.5rem] list-none grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-3.5 p-0">
            {INPUTS.map((input) => (
              <li key={input.title} className="flex flex-col gap-2.5 rounded-[1.375rem] border border-rule bg-paper p-[1.375rem]">
                <span aria-hidden className={`grid size-11 place-items-center rounded-option ${input.tile}`}>
                  <svg viewBox="0 0 24 24" className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={input.icon} />
                  </svg>
                </span>
                <h3 className="m-0 text-lg font-extrabold">{input.title}</h3>
                <p className="m-0 text-sm leading-normal text-pretty text-ink-soft">{input.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Try the Focus Score" className={`${wrap} pb-16 sm:pb-[6.5rem]`}>
          <FocusDemo />
        </section>

        <section className="night bg-mist text-ink">
          <div className={`${wrap} flex flex-wrap items-center gap-14 py-16 sm:py-[6.5rem]`}>
            <div className="flex flex-[1_1_22.5rem] flex-col gap-[1.125rem]">
              <p className={eyebrow}>Sleep and evenings</p>
              <h2 className={heading}>Tomorrow's focus starts at 9pm tonight.</h2>
              <p className="m-0 max-w-[30rem] text-lg leading-[1.55] text-pretty text-ink-soft">
                See a week of nights on one clock: when you slept, when you last ate and how long you were on screens after 10pm. Then read what it means in plain sentences.
              </p>
              <div className="mt-1.5 flex flex-col gap-2.5">
                <p className="m-0 rounded-control bg-paper px-4 py-3.5 text-md leading-normal">"On the 3 nights you ate after 21:00, you slept 52 minutes less."</p>
                <p className="m-0 rounded-control bg-paper px-4 py-3.5 text-md leading-normal">"Long screen nights pushed your bedtime about 40 minutes later."</p>
              </div>
              <p className="m-0 text-2xs text-ink-faint">Example insights from sample data.</p>
            </div>
            <NightsChart />
          </div>
        </section>

        <section className={`${wrap} py-16 sm:py-24`}>
          <div className="flex flex-wrap items-center justify-between gap-10 rounded-[2rem] border border-rule bg-paper p-7 sm:p-14">
            <div className="flex max-w-[32.5rem] flex-[1_1_22.5rem] flex-col gap-3.5">
              <p className={eyebrow}>Works with what you wear</p>
              <h2 className="m-0 text-2xl leading-[1.1] font-extrabold tracking-[-0.03em] text-balance sm:text-figure">Already tracking? Your wearable is next.</h2>
              <p className="m-0 text-base leading-[1.55] text-pretty text-ink-soft">Sync with Oura, Whoop and Apple Health is on the way, so your nights fill in on their own. Until then, logging bedtime and wake-up takes five seconds.</p>
            </div>
            <ul className="m-0 grid flex-[0_1_26.25rem] list-none grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2.5 p-0">
              {WEARABLES.map((name) => (
                <li key={name} className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-card bg-mist">
                  <span className="text-lg font-extrabold">{name}</span>
                  <span className="text-2xs text-ink-soft">Coming soon</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="science" className="scroll-mt-16 border-y border-rule bg-paper">
          <div className={`${wrap} flex flex-wrap gap-14 py-16 sm:py-[6.5rem]`}>
            <div className="flex max-w-[27.5rem] flex-[1_1_21.25rem] flex-col gap-[1.125rem]">
              <p className={eyebrow}>The science, plainly</p>
              <h2 className={heading}>How we calculate it</h2>
              <p className="m-0 text-lg leading-[1.55] text-pretty text-ink-soft">
                We lean on well-studied links between sleep, meal timing, blood sugar swings and stress. Then we show you your own week, not an average of everyone else's.
              </p>
              <p className="m-0 rounded-control bg-mist p-4 text-sm leading-normal text-ink-soft">
                NeuroCal isn't a medical device and doesn't diagnose anything. Talk to your doctor before changing medication or starting supplements.
              </p>
            </div>
            <ol className="m-0 flex flex-[1_1_28.75rem] list-none flex-col p-0">
              {SCIENCE.map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-t border-rule py-[1.375rem]">
                  <span aria-hidden className="pt-[3px] text-md font-extrabold text-synapse-ink">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="m-0 text-lg font-extrabold">{title}</h3>
                    <p className="mt-1.5 mb-0 text-md leading-[1.55] text-pretty text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className={`${wrap} scroll-mt-16 py-16 sm:py-[6.5rem]`}>
          <div className="flex flex-col items-center gap-3.5 text-center">
            <p className={eyebrow}>Pricing</p>
            <h2 className={heading}>Start free. Go Pro when you want the why.</h2>
            <div role="radiogroup" aria-label="Billing" className="mt-3 flex gap-1 rounded-pill border border-rule bg-paper p-1">
              {(
                [
                  ["Monthly", false],
                  ["Yearly", true],
                ] as const
              ).map(([label, isYearly]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={yearly === isYearly}
                  onClick={() => setYearly(isYearly)}
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-pill px-[1.125rem] text-sm font-bold ${yearly === isYearly ? "bg-ink text-mist" : "text-ink-soft hover:text-ink"}`}
                >
                  {label}
                  {isYearly && <span className="flex h-[1.375rem] items-center rounded-pill bg-ion-soft px-2 text-3xs text-ion-ink">Save 30%</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-11 grid max-w-[55rem] grid-cols-[repeat(auto-fit,minmax(18.75rem,1fr))] gap-5">
            <div className="flex flex-col gap-[1.125rem] rounded-sheet border border-rule bg-paper p-8">
              <div>
                <h3 className="m-0 text-xl font-extrabold">Free</h3>
                <p className="mt-1 mb-0 text-md text-ink-soft">Everything you need each day</p>
              </div>
              <p className="m-0 flex items-baseline gap-1.5">
                <span className="text-price leading-none font-extrabold tracking-[-0.03em]">£0</span>
                <span className="text-md text-ink-soft">forever</span>
              </p>
              <Link href="/sign-up" className="flex h-[3.25rem] items-center justify-center rounded-pill border-[1.5px] border-rule-strong text-base font-bold text-ink no-underline hover:bg-mist">
                Start free
              </Link>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {FREE.map((item) => (
                  <li key={item} className="flex gap-2.5 text-md leading-[1.4]">
                    {tick("text-ion")}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-[1.125rem] rounded-sheet bg-promo p-8 text-on-promo shadow-[0_24px_60px_var(--focus-ring)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="m-0 text-xl font-extrabold">Pro</h3>
                  <p className="mt-1 mb-0 text-md text-on-promo-soft">Patterns, routines and wearables</p>
                </div>
                <span className="flex h-[1.625rem] shrink-0 items-center rounded-pill bg-on-promo/20 px-2.5 text-2xs font-bold">Coming soon</span>
              </div>
              <p aria-live="polite" className="m-0 flex flex-wrap items-baseline gap-1.5">
                <span className="text-price leading-none font-extrabold tracking-[-0.03em]">£{yearly ? Math.round(PRO_MONTHLY * 12 * 0.7) : PRO_MONTHLY}</span>
                <span className="text-md text-on-promo-soft">{yearly ? `a year · £${(PRO_MONTHLY * 0.7).toFixed(2)} a month` : "a month"}</span>
              </p>
              <p className="m-0 flex h-[3.25rem] items-center justify-center rounded-pill bg-on-promo/20 px-4 text-center text-base font-bold">Free for everyone until Pro launches</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                <li className="text-sm font-bold text-on-promo-soft">Everything in Free, plus</li>
                {PRO.map((item) => (
                  <li key={item} className="flex gap-2.5 text-md leading-[1.4]">
                    {tick("text-promo-spark")}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-rule bg-paper">
          <div className="mx-auto max-w-[50rem] px-6 py-16 sm:py-24">
            <h2 className="m-0 mb-8 text-center text-3xl font-extrabold tracking-[-0.03em] sm:text-figure">Questions</h2>
            <div className="flex flex-col">
              {FAQS.map(([question, answer], i) => {
                const open = openFaq === i;
                return (
                  <div key={question} className="border-t border-rule">
                    <h3 className="m-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`${faqId}-${i}`}
                        onClick={() => setOpenFaq(open ? -1 : i)}
                        className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-lg font-bold text-ink"
                      >
                        {question}
                        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-mist text-xl font-semibold text-synapse-ink">
                          {open ? "−" : "+"}
                        </span>
                      </button>
                    </h3>
                    <p id={`${faqId}-${i}`} hidden={!open} className="m-0 pr-12 pb-[1.375rem] text-base leading-[1.6] text-pretty text-ink-soft">
                      {answer}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-paper px-6 pb-16 sm:pb-24">
          <div className="mx-auto flex max-w-[73.75rem] flex-col items-center gap-5 rounded-[2.25rem] bg-linear-to-br from-promo to-promo-deep px-6 py-10 text-center text-on-promo sm:px-16 sm:py-20">
            <svg viewBox="0 0 28 28" aria-hidden className="size-14">
              <path d="M20.5 7.5 A9.5 9.5 0 1 0 20.5 20.5" fill="none" stroke="var(--on-promo)" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="23.5" cy="14" r="2.2" fill="var(--promo-spark)" />
            </svg>
            <h2 className="m-0 max-w-[45rem] text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-display">Get your first Focus Score tomorrow morning.</h2>
            <p className="m-0 max-w-[32.5rem] text-lg leading-normal text-on-promo-soft">Log tonight's dinner and your sleep. That's all it takes.</p>
            <Link href="/sign-up" className="mt-2 flex h-[3.625rem] items-center gap-2.5 rounded-pill bg-on-promo px-8 text-lg font-extrabold text-promo no-underline hover:brightness-95">
              Start free
              {arrow}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-paper">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-5 py-8`}>
          <p className="m-0 flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="text-lg font-extrabold tracking-[-0.025em]">NeuroCal</span>
            <span className="ml-2 text-xs text-ink-soft">© 2026</span>
          </p>
          <p className="m-0 flex flex-wrap gap-5 text-sm font-semibold text-ink-soft">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Affiliate disclosure</span>
            <span>Contact</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The hero's phone: a sample Today screen, with two notes floating off it. Decorative. */
function Phone() {
  const signals = [
    ["Sleep", "7h 12m", "text-chlorophyll"],
    ["Evening timing", "Late", "text-glucose-ink"],
    ["Glycemic load", "Medium", "text-glucose-ink"],
    ["Stress", "Low", "text-chlorophyll"],
  ] as const;
  return (
    <div aria-hidden className="relative flex flex-[0_1_25rem] justify-center px-[1.875rem] py-5">
      <div className="absolute inset-x-0 inset-y-[8%] rounded-full bg-[radial-gradient(circle,var(--focus-ring),transparent_72%)]" />
      <div className="relative flex h-[38.75rem] w-[18.75rem] flex-col gap-2.5 overflow-hidden rounded-[2.75rem] bg-mist px-3.5 pt-[2.875rem] shadow-[0_0_0_9px_var(--device),0_40px_90px_var(--shade)]">
        <div className="px-1.5">
          <p className="m-0 text-3xs font-semibold text-ink-soft">Thursday 2 October</p>
          <p className="m-0 text-xl leading-tight font-extrabold tracking-[-0.02em]">Good afternoon, Sam</p>
        </div>
        <div className="rounded-card border border-rule bg-paper p-3.5">
          <div className="flex items-center gap-3">
            <FocusRing score={74} size={76} stroke={20}>
              <span className="text-2xl leading-none font-extrabold tracking-[-0.04em]">74</span>
            </FocusRing>
            <div>
              <p className="m-0 text-3xs font-semibold text-synapse-ink">Focus Score</p>
              <p className="m-0 text-base font-extrabold">Good</p>
              <p className="m-0 text-3xs leading-[1.4] text-ink-soft">Late dinner is the biggest drag. Expect a dip near 16:00.</p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {signals.map(([name, value, ink]) => (
              <div key={name} className="rounded-[0.625rem] bg-mist px-[9px] py-[7px]">
                <p className="m-0 text-4xs font-semibold text-ink-soft">{name}</p>
                <p className={`m-0 text-2xs font-bold ${ink}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.125rem] border border-rule bg-paper p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-extrabold">960 kcal left</span>
            <span className="text-4xs text-ink-soft">1,240 of 2,200</span>
          </div>
          <div className="mt-2 h-1.5 rounded-pill bg-track">
            <div className="h-full w-[56%] rounded-pill bg-synapse" />
          </div>
        </div>
        <div className="rounded-[1.125rem] border border-rule bg-paper p-3">
          <p className="m-0 text-3xs font-bold text-ink-soft">What to eat next</p>
          <p className="mt-[3px] mb-0 text-sm font-extrabold">Salmon, quinoa and greens</p>
          <p className="mt-0.5 mb-0 text-3xs text-ink-soft">25 min · 520 kcal · 38 g protein</p>
        </div>
        <div className="mt-auto flex gap-1.5 pt-3 pb-[1.125rem]">
          <span className="grid h-[2.625rem] flex-[1.5] place-items-center rounded-pill bg-synapse text-xs font-bold text-on-accent">Log a meal</span>
          <span className="grid h-[2.625rem] flex-1 place-items-center rounded-pill border-[1.5px] border-rule-strong bg-paper text-xs font-bold text-synapse-ink">Check in</span>
        </div>
      </div>
      <div className="absolute top-[7.5rem] -left-2 flex -rotate-[4deg] flex-col gap-0.5 rounded-control bg-paper px-3.5 py-2.5 shadow-chip">
        <span className="text-xs font-extrabold">Chicken wrap</span>
        <span className="text-3xs text-ink-soft">610 kcal</span>
        <span className="mt-1 flex h-5 items-center self-start rounded-pill bg-glucose-soft px-[7px] text-4xs font-bold text-glucose-ink">High glycemic load</span>
      </div>
      <div className="absolute -right-1.5 bottom-[9.375rem] flex rotate-3 items-center gap-2.5 rounded-control bg-paper px-3.5 py-2.5 shadow-chip">
        <span className="grid size-[1.875rem] place-items-center rounded-[0.625rem] bg-synapse-soft text-synapse-ink">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="text-xs font-extrabold">Slept 7h 12m</span>
          <span className="text-3xs text-ink-soft">Logged this morning</span>
        </span>
      </div>
    </div>
  );
}

/** A sample week on one clock, 18:00 to noon: the app's Sleep chart, on the dark band. Decorative. */
function NightsChart() {
  return (
    <figure aria-label="A sample week of nights on one clock" className="m-0 flex-[1_1_28.75rem] rounded-sheet border border-rule bg-paper px-[1.375rem] pt-6 pb-[2.125rem]">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-bold">Your nights on one clock</span>
        <span className="flex gap-3 text-2xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[7px] w-3.5 rounded-pill bg-synapse" />
            Asleep
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-glucose" />
            Last meal
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-[3px] w-3.5 bg-ion" />
            Screens
          </span>
        </span>
      </figcaption>
      <div aria-hidden className="mt-5 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
        <span />
        <div className="relative h-4 text-3xs font-semibold text-ink-faint">
          {TICKS.map((label, i) => (
            <span key={label} className={`absolute ${i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: pct(i * 3) }}>
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col">
          {NIGHTS.map(([day]) => (
            <span key={day} className="flex h-[2.125rem] items-center text-2xs font-bold text-ink-soft">
              {day}
            </span>
          ))}
        </div>
        <div className="relative">
          {TICKS.map((label, i) => (
            <span key={label} className="absolute inset-y-0 border-l border-rule" style={{ left: pct(i * 3) }} />
          ))}
          <span className="absolute -top-1 bottom-0 z-[2] border-l-[1.5px] border-dashed border-glucose" style={{ left: pct(3) }}>
            <span className="absolute -bottom-5 -left-[15px] text-3xs font-bold text-glucose-ink">21:00</span>
          </span>
          {NIGHTS.map(([day, bed, wake, meal, screens]) => (
            <div key={day} className="relative h-[2.125rem]">
              <span className="absolute top-[9px] h-3 rounded-pill bg-synapse" style={{ left: pct(fromSix(bed)), width: pct(fromSix(wake) - fromSix(bed)) }} />
              {screens > 0 && <span className="absolute top-[25px] h-[3px] rounded-pill bg-ion" style={{ left: pct(4), width: pct(screens / 60) }} />}
              <span className="absolute top-2.5 z-[3] -ml-[5px] size-2.5 rounded-full border-2 border-paper bg-glucose" style={{ left: pct(fromSix(meal)) }} />
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
