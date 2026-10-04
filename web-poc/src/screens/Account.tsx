"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { nextPath, useAuth, usesMockAuth } from "../auth/AuthProvider";
import { MOCK_CODE } from "../auth/mockAuth";
import { AuthError, PASSWORD_MIN_LENGTH, type AuthErrorCode } from "../auth/types";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { fieldClass, labelClass } from "../components/fields";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

interface Problem {
  title: string;
  body: string;
  /** Offer "Sign in instead" (the account already exists). */
  signIn?: boolean;
}

/** What went wrong and how to fix it, per kind of sign-in failure. */
const PROBLEMS: Record<AuthErrorCode, Problem> = {
  invalid_credentials: { title: "Those details don't match.", body: "Check your email and password and try again." },
  account_exists: { title: "You already have an account.", body: "An account with this email already exists.", signIn: true },
  weak_password: { title: "That password won't work.", body: `Use at least ${PASSWORD_MIN_LENGTH} characters, and avoid one that is easy to guess.` },
  invalid_code: { title: "Wrong code.", body: "Check the email and try again." },
  expired_code: { title: "This code has expired.", body: "Send a new code and enter that one." },
  too_many_attempts: { title: "Too many tries.", body: "Wait a few minutes, then try again." },
  unknown: { title: "That didn't work.", body: "Check your connection and try again." },
};
const problemOf = (error: unknown): Problem => PROBLEMS[error instanceof AuthError ? error.code : "unknown"];

const textLink = "font-bold text-synapse-ink hover:underline hover:underline-offset-4";

/** Account screens: one column, phone width, with room for the logo row on top. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-6 pt-10 pb-[max(2rem,env(safe-area-inset-bottom))]"
      style={{ animation: "enter var(--duration-step) var(--ease-settle)" }}
    >
      {children}
    </main>
  );
}

function Problems({ problem }: { problem: Problem | null }) {
  if (!problem) return null;
  return (
    <ErrorPanel
      title={problem.title}
      action={
        problem.signIn && (
          <Link href="/sign-in" className="mt-1 font-bold underline">
            Sign in instead
          </Link>
        )
      }
    >
      {problem.body}
    </ErrorPanel>
  );
}

function Submit({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <Button type="submit" className="mt-6 w-full" disabled={busy || disabled}>
      {busy && <Spinner />}
      {children}
    </Button>
  );
}

function Credentials({
  email,
  password,
  onEmail,
  onPassword,
  invalid,
  newPassword,
}: {
  email: string;
  password: string;
  onEmail(v: string): void;
  onPassword(v: string): void;
  invalid: boolean;
  newPassword?: boolean;
}) {
  const emailId = useId();
  const passwordId = useId();
  const ruleId = useId();
  const [shown, setShown] = useState(false);
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const field = `${fieldClass} ${invalid ? "border-beet" : ""}`;

  return (
    <div className="mt-7 flex flex-col gap-4">
      <div>
        <label htmlFor={emailId} className={labelClass}>
          Email
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={passwordId} className={labelClass}>
          Password
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={shown ? "text" : "password"}
            autoComplete={newPassword ? "new-password" : "current-password"}
            required
            aria-describedby={newPassword ? ruleId : undefined}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className={`${field} pr-[4.5rem]`}
          />
          <button
            type="button"
            aria-pressed={shown}
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => setShown((s) => !s)}
            className="absolute top-[0.6875rem] right-1.5 h-11 cursor-pointer px-3 text-sm font-semibold text-synapse-ink"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
        {newPassword && (
          <p id={ruleId} className={`mt-1.5 mb-0 flex items-center gap-2 text-xs font-medium ${longEnough ? "text-chlorophyll" : "text-ink-soft"}`}>
            <span
              aria-hidden
              className={`grid size-4 place-items-center rounded-full border-[1.5px] border-current text-[0.625rem] ${longEnough ? "bg-chlorophyll" : ""}`}
            >
              <span className="text-on-good">{longEnough ? "✓" : ""}</span>
            </span>
            {longEnough ? `At least ${PASSWORD_MIN_LENGTH} characters` : `At least ${PASSWORD_MIN_LENGTH} characters · ${password.length} so far`}
          </p>
        )}
      </div>
    </div>
  );
}

/** Signs in and goes where the visitor was heading (or Today, which sends new accounts to setup). */
function useFinishSignIn() {
  const { client, refresh } = useAuth();
  const router = useRouter();
  return async (email: string, password: string) => {
    const step = await client!.signIn(email, password);
    if (step === "confirm") return "confirm" as const;
    await refresh();
    router.replace(nextPath());
    return "done" as const;
  };
}

export function SignIn() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finish = useFinishSignIn();

  if (confirming) return <ConfirmEmail email={email} password={password} onBack={() => setConfirming(false)} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setProblem({ title: "Missing details.", body: "Enter your email and password." });
    setBusy(true);
    setProblem(null);
    try {
      if ((await finish(email, password)) === "confirm") setConfirming(true);
      else toast("Signed in");
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <ThemeToggle />
      </div>
      <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">Eat for how you want to think.</h1>
      <p className="mt-2 mb-0 text-base leading-normal text-pretty text-ink-soft">
        Snap your meals. NeuroCal reads them against your sleep and stress and tells you what to eat next.
      </p>
      <form onSubmit={submit} noValidate aria-label="Sign in">
        <Credentials
          email={email}
          password={password}
          invalid={problem !== null}
          onEmail={(v) => (setEmail(v), setProblem(null))}
          onPassword={(v) => (setPassword(v), setProblem(null))}
        />
        <Problems problem={problem} />
        <Submit busy={busy}>{busy ? "Signing in…" : "Sign in"}</Submit>
      </form>
      <p className="mt-5 mb-0 text-center text-md font-medium text-ink-soft">
        New here?{" "}
        <Link href="/sign-up" className={textLink}>
          Create an account
        </Link>
      </p>
    </Frame>
  );
}

export function SignUp() {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (confirming) return <ConfirmEmail email={email} password={password} created onBack={() => setConfirming(false)} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await client!.signUp(email, password);
      setConfirming(true);
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Logo />
      <h1 className="mt-8 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">Create an account</h1>
      <p className="mt-2 mb-0 text-base leading-normal text-pretty text-ink-soft">Your meals, sleep and check-ins stay private to this account.</p>
      <form onSubmit={submit} noValidate aria-label="Create an account">
        <Credentials
          email={email}
          password={password}
          invalid={problem !== null}
          newPassword
          onEmail={(v) => (setEmail(v), setProblem(null))}
          onPassword={(v) => (setPassword(v), setProblem(null))}
        />
        <Problems problem={problem} />
        <Submit busy={busy} disabled={!email || password.length < PASSWORD_MIN_LENGTH}>
          {busy ? "Creating account…" : "Create account"}
        </Submit>
      </form>
      <p className="mt-5 mb-0 text-center text-md font-medium text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className={textLink}>
          Sign in
        </Link>
      </p>
    </Frame>
  );
}

/** Six boxes showing the code as it is typed; one real input sits invisibly on top of them. */
function ConfirmEmail({ email, password, created, onBack }: { email: string; password: string; created?: boolean; onBack(): void }) {
  const { client } = useAuth();
  const toast = useToast();
  const finish = useFinishSignIn();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setProblem(null);
    try {
      await client!.confirmSignUp(email, code);
      if (created) toast("Account created");
      await finish(email, password);
    } catch (err) {
      setProblem(problemOf(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setProblem(null);
    setCode("");
    try {
      await client!.resendCode(email);
      toast(`New code sent to ${email}`);
    } catch (err) {
      setProblem(problemOf(err));
    }
  };

  return (
    <Frame>
      <button type="button" aria-label="Back" onClick={onBack} className="-ml-3 grid size-11 cursor-pointer place-items-center text-ink">
        <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 className="mt-4 mb-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em]">Check your email</h1>
      <p className="mt-2 mb-0 text-base leading-normal text-pretty text-ink-soft">
        We sent a six-digit code to <b className="text-ink">{email}</b>.
      </p>
      <form onSubmit={submit} noValidate aria-label="Confirm your email">
        <div className="relative mt-7">
          <div aria-hidden className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const next = i === code.length;
              return (
                <span
                  key={i}
                  className={`grid h-[3.75rem] place-items-center rounded-option border-[1.5px] bg-paper text-xl font-bold tabular-nums transition-[transform,border-color,box-shadow] duration-200 ${
                    problem ? "border-beet" : next ? "border-synapse shadow-[0_0_0_3px_var(--focus-ring)]" : "border-rule-strong"
                  } ${code[i] ? "" : "scale-[0.96]"}`}
                >
                  {code[i] ?? ""}
                </span>
              );
            })}
          </div>
          <input
            aria-label="Six-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => (setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), setProblem(null))}
            className="absolute inset-0 size-full cursor-text text-base opacity-0"
          />
        </div>
        {usesMockAuth && <p className="mt-3 mb-0 text-sm text-ink-soft">Test mode: the code is {MOCK_CODE}.</p>}
        <Problems problem={problem} />
        <Submit busy={busy} disabled={code.length !== 6}>
          Confirm
        </Submit>
      </form>
      <Button variant="text" className="mt-2.5 h-12" onClick={resend}>
        Send a new code
      </Button>
    </Frame>
  );
}
