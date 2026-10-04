"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { FocusRing } from "../components/FocusRing";
import { Logo } from "../components/Logo";
import { markIntroSeen } from "../lib/intro";

const SLIDES = [
  { title: "Food changes how you think.", body: "What you eat, and when, shows up in your focus a few hours later." },
  { title: "Snap a meal. We read the plate.", body: "One photo. NeuroCal finds each item, its portion, calories and glycemic load." },
  { title: "Your nights count too.", body: "Sleep, late dinners, evening screens and stress all feed in." },
  { title: "One Focus Score, every morning.", body: "0 to 100, with a plain sentence on what's pushing it up or down." },
  { title: "Know what to eat next.", body: "A suggestion that fits your diet, your targets and the day you're having." },
] as const;

/** The score the ring counts up to on the fourth slide. */
const SAMPLE_SCORE = 74;

/** Where each piece sits on each of the five slides: [x, y, scale, opacity, rotation], on a 390 × 440 stage. */
type Pose = readonly [x: number, y: number, scale: number, opacity: number, rotate: number];
const POSES: Record<string, readonly Pose[]> = {
  ring: [[195, 220, 0.4, 0, 0], [195, 220, 0.4, 0, 0], [195, 220, 0.5, 0, 0], [195, 205, 1, 1, 0], [195, 108, 0.62, 1, 0]],
  frame: [[195, 215, 0.85, 0, 0], [195, 215, 1, 1, 0], [195, 215, 1.15, 0, 0], [195, 205, 0.6, 0, 0], [195, 108, 0.4, 0, 0]],
  meal0: [[120, 112, 1, 1, -8], [195, 150, 1, 1, 0], [96, 52, 0.75, 0.45, -6], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  meal1: [[236, 208, 1, 1, 6], [195, 206, 1, 1, 0], [272, 86, 0.75, 0.45, 7], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  meal2: [[140, 308, 1, 1, -4], [195, 262, 1, 1, 0], [288, 378, 0.75, 0.45, -5], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  signal0: [[480, 150, 1, 0, 12], [480, 150, 1, 0, 12], [126, 166, 1.05, 1, -5], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  signal1: [[490, 240, 1, 0, -10], [490, 240, 1, 0, -10], [266, 238, 1.05, 1, 4], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  signal2: [[480, 320, 1, 0, 8], [480, 320, 1, 0, 8], [144, 308, 1.05, 1, -3], [195, 205, 0.3, 0, 0], [195, 108, 0.2, 0, 0]],
  suggestion: [[195, 560, 0.9, 0, 0], [195, 560, 0.9, 0, 0], [195, 560, 0.9, 0, 0], [195, 560, 0.9, 0, 0], [195, 312, 1, 1, 0]],
};

const CHIPS = [
  { id: "meal0", name: "Oat bowl", value: "420 kcal", dot: "bg-chlorophyll-bar" },
  { id: "meal1", name: "Chicken wrap", value: "610 kcal", dot: "bg-glucose" },
  { id: "meal2", name: "Salmon and rice", value: "540 kcal", dot: "bg-chlorophyll-bar" },
  { id: "signal0", name: "Sleep", value: "7h 12m", dot: "bg-ion" },
  { id: "signal1", name: "Last meal", value: "22:40", dot: "bg-synapse" },
  { id: "signal2", name: "Stress", value: "Low", dot: "bg-ion" },
] as const;

/** Positions a piece for the current slide; pieces glide between slides with a spring. */
function pose(id: string, slide: number, order = 0): CSSProperties {
  const [x, y, scale, opacity, rotate] = POSES[id]![slide]!;
  // Chips leave one after another; the ring waits for them on the score slide.
  const delay = order ? (order - 1) * (slide === 3 ? 80 : 55) : id === "ring" && slide === 3 ? 250 : 0;
  return {
    transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
    opacity,
    transition: `transform var(--duration-stage) var(--ease-spring) ${delay}ms, opacity calc(var(--duration-stage) / 2) ease ${delay}ms`,
  };
}

/** The illustrated stage, shared with the "Profile saved" screen (which shows the signals around a tick). */
export function Chip({ id, slide, order }: { id: (typeof CHIPS)[number]["id"]; slide: number; order: number }) {
  const chip = CHIPS.find((c) => c.id === id)!;
  return (
    <div className="pointer-events-none absolute top-0 left-0 will-change-transform" style={pose(id, slide, order)}>
      <div className="flex items-center gap-2.5 rounded-control border border-rule bg-paper px-3.5 py-2.5 whitespace-nowrap shadow-chip">
        <span className={`size-2.5 rounded-full ${chip.dot}`} />
        <span className="text-md font-semibold">{chip.name}</span>
        <span className="text-sm font-medium text-ink-soft">{chip.value}</span>
      </div>
    </div>
  );
}

/**
 * First-run intro: five slides that explain NeuroCal with one moving
 * illustration. Tap the illustration or "Next" to move on; "Skip" goes to sign in.
 */
export function Intro() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [score, setScore] = useState(0);
  const last = slide === SLIDES.length - 1;

  useEffect(() => markIntroSeen(), []);

  // The ring counts up when the score slide arrives, and holds its value after.
  useEffect(() => {
    if (slide < 3) return setScore(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setScore(SAMPLE_SCORE);
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => setScore((s) => (s >= SAMPLE_SCORE ? (window.clearInterval(timer), s) : Math.min(SAMPLE_SCORE, s + 2))), 18);
    }, 650);
    return () => (window.clearTimeout(start), window.clearInterval(timer));
  }, [slide]);

  const next = () => !last && setSlide((s) => s + 1);
  const copy = SLIDES[slide]!;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col overflow-hidden pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex h-11 items-center justify-between pt-10 pr-3 pl-6">
        <Logo />
        {!last && (
          <Link href="/sign-in" className="flex h-11 items-center px-3 text-md font-semibold text-ink-soft hover:text-ink">
            Skip
          </Link>
        )}
      </div>

      {/* 390 px wide by design; centred, and clipped on narrower phones. */}
      {/* Tapping the illustration moves on too; keyboard and screen readers use the Next button. */}
      <div onClick={next} aria-hidden className="relative mt-6 h-[27.5rem] w-full cursor-pointer">
        <div className="absolute top-0 left-1/2 h-full w-[24.375rem] -translate-x-1/2 text-left">
          <div className="pointer-events-none absolute top-0 left-0 block will-change-transform" style={pose("frame", slide)}>
            <div className="relative block h-[15.625rem] w-[16.875rem] overflow-hidden rounded-[1.875rem] border-[3px] border-synapse bg-synapse-soft">
              <div className="scan-line absolute right-4 left-4 block h-[3px] rounded-pill bg-ion shadow-[0_0_14px_var(--ion)]" style={{ animation: "scan 2.2s ease-in-out infinite" }} />
              <div className="absolute right-0 bottom-3 left-0 block text-center text-xs font-semibold text-synapse-ink">Reading your plate…</div>
            </div>
          </div>

          <div className="pointer-events-none absolute top-0 left-0 block will-change-transform" style={pose("ring", slide)}>
            <FocusRing score={score} size={200}>
              <div className="text-display leading-none font-extrabold tracking-[-0.035em] tabular-nums">{score}</div>
              <div className="mt-1 text-xs font-medium text-ink-soft">Focus score</div>
            </FocusRing>
          </div>

          {CHIPS.map((chip, i) => (
            <Chip key={chip.id} id={chip.id} slide={slide} order={i + 1} />
          ))}

          <div className="pointer-events-none absolute top-0 left-0 block will-change-transform" style={pose("suggestion", slide)}>
            <div className="block w-[19.375rem] rounded-[1.375rem] border border-rule bg-paper p-4 shadow-[0_10px_28px_var(--shade)]">
              <div className="block text-xs font-semibold text-synapse-ink">What to eat next</div>
              <div className="mt-1 block text-lg font-bold">Salmon, rice and greens</div>
              <div className="mt-0.5 block text-xs font-medium text-ink-soft">25 min · 540 kcal · 38 g protein</div>
              <div className="mt-2.5 block border-t border-rule pt-2.5 text-sm leading-[1.45] text-pretty">
                Slow carbs and omega-3 keep your focus steady this afternoon.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6">
        <div key={slide} aria-live="polite" style={{ animation: "toast-in 400ms ease" }}>
          <h1 className="m-0 text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">{copy.title}</h1>
          <p className="mt-2.5 mb-0 text-base leading-normal text-pretty text-ink-soft">{copy.body}</p>
        </div>
        <div className="min-h-6 flex-1" />
        <div aria-hidden className="mb-4 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-2 rounded-pill transition-[width,background-color] duration-300 ${i === slide ? "w-[1.625rem] bg-synapse" : "w-2 bg-track"}`} />
          ))}
        </div>
        {last ? (
          <div className="flex flex-col gap-1">
            <Button onClick={() => router.push("/sign-up")}>Create an account</Button>
            <Button variant="text" className="h-12" onClick={() => router.push("/sign-in")}>
              I already have an account
            </Button>
          </div>
        ) : (
          <Button onClick={next}>Next</Button>
        )}
      </div>
    </main>
  );
}
