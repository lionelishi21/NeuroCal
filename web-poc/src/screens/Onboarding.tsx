"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { RequestFailed } from "../api/client";
import { useUpdateProfile } from "../api/queries";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { fieldClass, labelClass } from "../components/fields";
import { FocusRing } from "../components/FocusRing";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import {
  type Answers,
  type Choice,
  type Question,
  DAILY_CALORIES,
  STEPS,
  STEP_COUNT,
  dayPlan,
  dietLabelOf,
  macroRatio,
  stepComplete,
  toProfileFields,
  visibleQuestions,
} from "../lib/bioProfile";
import { browserTimeZone, timeZones } from "../lib/targets";
import { Chip } from "./Intro";

/** Devices that will feed sleep and activity in automatically. Not connected yet: shown so people know it is coming. */
const DEVICES = [
  { name: "Oura", detail: "Ring", initial: "O" },
  { name: "Whoop", detail: "Strap", initial: "W" },
  { name: "Apple Health", detail: "iPhone and Watch", initial: "A" },
] as const;

const selected = "border-synapse bg-synapse-soft";
const unselected = "border-rule-strong bg-paper";
const option = "cursor-pointer border-[1.5px] text-left transition-[transform,background-color,border-color] duration-[var(--duration-select)] ease-spring";

/**
 * The bio-profile onboarding: name and time zone, then ten short steps of
 * questions, ending in the profile they produce. Saves once, at the end.
 */
export function Onboarding() {
  const router = useRouter();
  const toast = useToast();
  const save = useUpdateProfile();
  const nameId = useId();
  const zoneId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const [answers, setAnswers] = useState<Answers>({});
  const [done, setDone] = useState(false);

  const current = step === 0 ? null : STEPS[step - 1]!;
  const isLast = step === STEP_COUNT - 1;
  const ready = current ? stepComplete(current, answers) : name.trim().length > 0;

  const go = (to: number) => {
    setDirection(to >= step ? 1 : -1);
    setStep(to);
    if (scroller.current) scroller.current.scrollTop = 0;
  };

  const pick = (question: Question, value: string) =>
    setAnswers((a) =>
      question.key === "supplements"
        ? { ...a, supplements: a.supplements?.includes(value) ? a.supplements.filter((v) => v !== value) : [...(a.supplements ?? []), value] }
        : { ...a, [question.key]: value },
    );

  const next = () => {
    if (!ready || save.isPending) return;
    if (!isLast) return go(step + 1);
    save.mutate(
      { displayName: name.trim(), timeZone, ...toProfileFields(answers) },
      {
        onSuccess: () => {
          toast("Bio-profile saved");
          setDone(true);
        },
      },
    );
  };

  if (done) return <ProfileSaved name={name.trim()} onContinue={() => router.replace("/")} />;

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[26rem] flex-col px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex h-11 items-center justify-between">
        <button
          type="button"
          aria-label="Back"
          onClick={() => go(step - 1)}
          className={`-ml-3 grid size-11 cursor-pointer place-items-center text-ink ${step === 0 ? "invisible" : ""}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p className="m-0 text-sm font-semibold text-ink-soft">
          Step {step + 1} of {STEP_COUNT}
        </p>
      </div>
      <div aria-hidden className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${STEP_COUNT}, minmax(0, 1fr))` }}>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span key={i} className="h-1.5 overflow-hidden rounded-pill bg-track">
            <span className={`block h-full rounded-pill bg-synapse transition-[width] duration-[var(--duration-step)] ease-settle ${i <= step ? "w-full" : "w-0"}`} />
          </span>
        ))}
      </div>

      <div ref={scroller} className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
        <section
          key={step}
          aria-labelledby="step-title"
          className="mt-5 pb-5"
          style={{ animation: "enter var(--duration-step) var(--ease-settle)", ["--enter-from" as string]: `${direction * 2.25}rem` }}
        >
          <p className="m-0 text-2xs font-bold tracking-[0.06em] text-synapse-ink uppercase">{current ? current.eyebrow : "Identity & sync"}</p>
          <h1 id="step-title" className="mt-1.5 mb-0 text-2xl leading-[1.15] font-extrabold tracking-[-0.02em] text-balance">
            {current ? current.title : "Let's start with you"}
          </h1>
          {current?.detail && <p className="mt-1.5 mb-0 text-md leading-[1.45] text-pretty text-ink-soft">{current.detail}</p>}

          {!current && (
            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label htmlFor={nameId} className={labelClass}>
                  First name
                </label>
                <input id={nameId} autoFocus autoComplete="given-name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={zoneId} className={labelClass}>
                  Time zone
                </label>
                <select id={zoneId} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={fieldClass}>
                  {timeZones(timeZone).map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1.5 flex flex-col gap-2">
                <h2 className="m-0 text-md font-bold">Connect your hardware</h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {DEVICES.map((device) => (
                    <li key={device.name} className="flex min-h-16 items-center gap-3 rounded-control border border-rule bg-paper py-2 pr-4 pl-3">
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[0.75rem] bg-track text-base font-extrabold">
                        {device.initial}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-md font-bold">{device.name}</span>
                        <span className="block text-xs text-ink-soft">{device.detail}</span>
                      </span>
                      <span className="text-sm font-bold text-ink-faint">Coming soon</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 text-xs leading-[1.45] text-ink-soft">Until devices connect, you log sleep by hand on the Today screen.</p>
              </div>
            </div>
          )}

          {current && (
            <div className="mt-5 flex flex-col gap-6">
              {visibleQuestions(current, answers).map((question) => (
                <QuestionField key={question.key} question={question} answers={answers} legendFallback={current.title} onPick={(value) => pick(question, value)} />
              ))}
            </div>
          )}

          {isLast && <BioProfileCard answers={answers} />}
        </section>
      </div>

      {save.isError && (
        <ErrorPanel title="Your bio-profile didn't save.">
          {save.error instanceof RequestFailed ? save.error.message : "Check your connection and try again."}
        </ErrorPanel>
      )}
      <Button className="mt-3 w-full" disabled={!ready || save.isPending} onClick={next}>
        {save.isPending && <Spinner />}
        {isLast ? (save.isPending ? "Saving…" : "Save bio-profile") : "Continue"}
      </Button>
    </main>
  );
}

function QuestionField({ question, answers, legendFallback, onPick }: { question: Question; answers: Answers; legendFallback: string; onPick(value: string): void }) {
  const isOn = (value: string) => (question.key === "supplements" ? (answers.supplements ?? []).includes(value) : answers[question.key] === value);
  const multi = question.kind === "multi";
  // Single-choice options are radios; "pick any" options are toggle buttons.
  const optionProps = (choice: Choice) =>
    multi ? { "aria-pressed": isOn(choice[0]) } : { role: "radio" as const, "aria-checked": isOn(choice[0]) };

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0" {...(multi ? {} : { role: "radiogroup" })}>
      <legend className={`flex w-full items-baseline justify-between gap-3 p-0 ${question.prompt ? "mb-2.5" : "sr-only"}`}>
        <span className="text-md leading-[1.4] font-bold text-pretty">{question.prompt ?? legendFallback}</span>
        {question.note && <span className="shrink-0 text-xs font-medium text-ink-soft">{question.note}</span>}
      </legend>

      {question.kind === "rows" && (
        <div className="flex flex-col gap-2">
          {question.options.map((choice) => {
            const [value, label, detail] = choice;
            const on = isOn(value);
            return (
              <button
                key={value}
                type="button"
                {...optionProps(choice)}
                onClick={() => onPick(value)}
                className={`${option} flex items-center justify-between gap-3 rounded-control px-4 py-2.5 ${detail ? "min-h-16" : "min-h-[3.375rem]"} ${on ? `${selected} scale-[1.02]` : unselected}`}
              >
                <span className="min-w-0">
                  <span className="block text-md font-bold">{label}</span>
                  {detail && <span className="block text-xs text-ink-soft">{detail}</span>}
                </span>
                <span aria-hidden className={`size-[1.375rem] shrink-0 rounded-full bg-paper transition-[border] duration-[var(--duration-select)] ${on ? "border-[7px] border-synapse" : "border-2 border-rule-strong"}`} />
              </button>
            );
          })}
        </div>
      )}

      {(question.kind === "pills" || multi) && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((choice) => {
            const [value, label] = choice;
            const on = isOn(value);
            return (
              <button
                key={value}
                type="button"
                {...optionProps(choice)}
                onClick={() => onPick(value)}
                className={`${option} flex min-h-11 items-center gap-1.5 rounded-pill px-4 text-md font-semibold ${on ? `${selected} scale-[1.04] text-synapse-ink` : `${unselected} text-ink`}`}
              >
                {multi && on && <span aria-hidden>✓</span>}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "segments" && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${question.options.length}, minmax(0, 1fr))` }}>
          {question.options.map((choice) => {
            const [value, label] = choice;
            const on = isOn(value);
            return (
              <button
                key={value}
                type="button"
                {...optionProps(choice)}
                onClick={() => onPick(value)}
                className={`${option} grid h-12 place-items-center rounded-option text-md font-semibold ${on ? `${selected} scale-[1.04] text-synapse-ink` : `${unselected} text-ink`}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "grid" && (
        <div className="grid grid-cols-2 gap-2.5">
          {question.options.map((choice) => {
            const [value, label, detail] = choice;
            const on = isOn(value);
            return (
              <button
                key={value}
                type="button"
                {...optionProps(choice)}
                onClick={() => onPick(value)}
                className={`${option} min-h-[7.75rem] rounded-card p-3.5 ${on ? `${selected} -translate-y-[3px]` : unselected}`}
              >
                <span
                  aria-hidden
                  className={`grid size-[1.625rem] place-items-center rounded-full text-sm font-extrabold text-on-accent transition-colors duration-[var(--duration-select)] ${on ? "bg-synapse" : "border-2 border-rule-strong"}`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="mt-3 block text-md leading-[1.3] font-bold">{label}</span>
                <span className="mt-0.5 block text-xs leading-[1.4] text-ink-soft">{detail}</span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

const SHARE_COLOR = { Fat: "bg-glucose", Protein: "bg-synapse", Carbs: "bg-ion" } as const;

/** What the answers add up to: the starting macro ratio and the day's rhythm. Dimmed until a goal is chosen. */
function BioProfileCard({ answers }: { answers: Answers }) {
  const ratio = macroRatio(answers.diet);
  return (
    <section
      aria-labelledby="bio-profile-title"
      className={`mt-6 rounded-card border border-rule bg-paper p-4 transition-[opacity,transform] duration-[var(--duration-step)] ${answers.goal ? "" : "translate-y-2 opacity-50"}`}
    >
      <p className="m-0 text-2xs font-bold tracking-[0.06em] text-synapse-ink uppercase">Your bio-profile</p>
      <h2 id="bio-profile-title" className="mt-1 mb-0 text-lg font-bold">
        Starting macro ratio
      </h2>
      <div aria-hidden className="mt-3 flex h-3 gap-[3px]">
        {ratio
          .filter((share) => share.percent > 0)
          .map((share) => (
            <span key={share.name} className={`rounded-[3px] ${SHARE_COLOR[share.name]}`} style={{ flex: `${share.percent} 0 0` }} />
          ))}
      </div>
      <dl className="m-0 mt-3 grid grid-cols-3 gap-2">
        {ratio.map((share) => (
          <div key={share.name}>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <span aria-hidden className={`size-2 rounded-full ${SHARE_COLOR[share.name]}`} />
              {share.name}
            </dt>
            <dd className="m-0">
              <span className="block text-xl font-extrabold tracking-[-0.02em]">{share.percent}%</span>
              <span className="block text-xs font-medium text-ink-soft">{share.grams} g</span>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="m-0 mt-3.5 border-t border-rule">
        {dayPlan(answers).map((row) => (
          <div key={row.label} className="flex justify-between gap-3 border-b border-rule py-[0.6875rem]">
            <dt className="text-sm font-medium text-ink-soft">{row.label}</dt>
            <dd className="m-0 text-right text-sm font-bold">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 mb-0 text-xs leading-[1.45] text-pretty text-ink-soft">
        Based on {dietLabelOf(answers.diet)?.toLowerCase() ?? "a standard diet"}, your wake time and a {DAILY_CALORIES.toLocaleString()} kcal day. Adjust any time in
        Settings.
      </p>
    </section>
  );
}

/** The closing screen: the signals gather around a tick, then on to Today. */
function ProfileSaved({ name, onContinue }: { name: string; onContinue(): void }) {
  // Chips start scattered and settle behind the tick, as in the intro's fourth slide.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 40);
    return () => window.clearTimeout(timer);
  }, []);
  const slide = settled ? 3 : 2;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col overflow-hidden pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div aria-hidden className="relative mt-14 h-[26rem]">
        <div className="absolute top-0 left-1/2 h-full w-[24.375rem] -translate-x-1/2">
          {(["meal0", "meal1", "meal2", "signal0", "signal1", "signal2"] as const).map((id, i) => (
            <Chip key={id} id={id} slide={slide} order={i + 1} />
          ))}
          <div className="absolute top-[12.8125rem] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FocusRing score={null} size={200}>
              <svg viewBox="0 0 24 24" className="size-11" fill="none" stroke="var(--chlorophyll)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              <span className="mt-1 text-xs font-semibold text-ink-soft">Profile saved</span>
            </FocusRing>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-6">
        <h1 className="m-0 text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.025em]">You're set, {name}.</h1>
        <p className="mt-2.5 mb-0 text-base leading-normal text-pretty text-ink-soft">
          Your first Focus Score appears once you log last night's sleep or check in.
        </p>
        <div className="min-h-6 flex-1" />
        <Button onClick={onContinue}>Go to Today</Button>
      </div>
    </main>
  );
}
