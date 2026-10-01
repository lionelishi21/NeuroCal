"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { nextPath, useAuth, usesMockAuth } from "../auth/AuthProvider";
import { MOCK_CODE } from "../auth/mockAuth";
import { AuthError, PASSWORD_MIN_LENGTH } from "../auth/types";
import { Button } from "../components/Button";
import { fieldClass } from "../components/fields";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

const linkClass = "text-ink underline decoration-rule underline-offset-4 hover:decoration-ink";
const message = (e: unknown) => (e instanceof AuthError ? e.message : "Something went wrong. Try again.");

/** Account screens: ambient glow, the NeuroCal mark, one column. */
function Frame({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(28rem_22rem_at_85%_0%,color-mix(in_oklab,var(--synapse)_28%,transparent),transparent_70%),radial-gradient(24rem_20rem_at_0%_35%,color-mix(in_oklab,var(--ion)_16%,transparent),transparent_70%)]"
      />
      <main className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:pt-16">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <ThemeToggle />
        </div>
        {intro}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

/** Sign-in pitch: what NeuroCal is, in one line, and the three things it measures. */
const Pitch = (
  <div className="mt-10">
    <p className="m-0 text-[length:var(--text-2xl)] leading-[1.05] font-extrabold tracking-tight text-balance">
      Eat for how you want to think.
      <span className="block bg-[linear-gradient(90deg,var(--synapse),var(--ion))] bg-clip-text text-transparent">
        Tonight, tomorrow, this week.
      </span>
    </p>
    <p className="mt-3 mb-0 text-ink-soft">
      Snap your meals. NeuroCal reads them against your sleep and stress and tells you what to eat next.
    </p>
    <ul aria-label="What NeuroCal measures" className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0 text-xs text-ink-soft">
      <li className="rounded-pill px-3 py-1.5 ring-1 ring-rule ring-inset"><b className="font-semibold text-ink">Focus</b> 0–100</li>
      <li className="rounded-pill px-3 py-1.5 ring-1 ring-rule ring-inset"><b className="font-semibold text-ink">Glycemic load</b> per meal</li>
      <li className="rounded-pill px-3 py-1.5 ring-1 ring-rule ring-inset"><b className="font-semibold text-ink">Sleep</b> 7-day</li>
    </ul>
  </div>
);

function Credentials({
  email,
  password,
  onEmail,
  onPassword,
  newPassword,
}: {
  email: string;
  password: string;
  onEmail(v: string): void;
  onPassword(v: string): void;
  newPassword?: boolean;
}) {
  const emailId = useId();
  const passwordId = useId();
  const hintId = useId();
  return (
    <>
      <label htmlFor={emailId} className="mt-6 block text-sm text-ink-soft">
        Email
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label htmlFor={passwordId} className="mt-5 block text-sm text-ink-soft">
        Password
        <input
          id={passwordId}
          type="password"
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={newPassword ? PASSWORD_MIN_LENGTH : undefined}
          aria-describedby={newPassword ? hintId : undefined}
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          className={fieldClass}
        />
        {newPassword && (
          <span id={hintId} className="mt-1.5 block">
            At least {PASSWORD_MIN_LENGTH} characters.
          </span>
        )}
      </label>
    </>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mt-5 mb-0 text-sm text-beet">
      {text}
    </p>
  ) : null;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finish = useFinishSignIn();

  if (confirming) return <ConfirmEmail email={email} password={password} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if ((await finish(email, password)) === "confirm") setConfirming(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame intro={Pitch}>
      <form onSubmit={submit} noValidate={false}>
        <h1 className="m-0 text-lg">Sign in</h1>
        <Credentials email={email} password={password} onEmail={setEmail} onPassword={setPassword} />
        <ErrorLine text={error} />
        <Button type="submit" className="mt-8 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 mb-0 text-ink-soft">
        New here?{" "}
        <Link href="/sign-up" className={linkClass}>
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (confirming) return <ConfirmEmail email={email} password={password} created />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await client!.signUp(email, password);
      setConfirming(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <form onSubmit={submit}>
        <h1 className="m-0 text-2xl">Create an account</h1>
        <p className="mt-2 mb-0 text-ink-soft">Your meals, sleep and check-ins stay private to this account.</p>
        <Credentials email={email} password={password} onEmail={setEmail} onPassword={setPassword} newPassword />
        <ErrorLine text={error} />
        <Button type="submit" className="mt-8 w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-8 mb-0 text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </Frame>
  );
}

/** The one figure moment: the code is typed in the same face as the Focus Score dial. */
function ConfirmEmail({ email, password, created }: { email: string; password: string; created?: boolean }) {
  const { client } = useAuth();
  const toast = useToast();
  const finish = useFinishSignIn();
  const codeId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await client!.confirmSignUp(email, code);
      if (created) toast("Account created");
      await finish(email, password);
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await client!.resendCode(email);
      toast("New code sent");
    } catch (err) {
      setError(message(err));
    }
  };

  return (
    <Frame>
      <form onSubmit={submit}>
        <h1 className="m-0 text-2xl">Check your email</h1>
        <p className="mt-2 mb-0 text-ink-soft">
          Enter the 6-digit code we sent to <span className="text-ink">{email}</span>.
        </p>
        <label htmlFor={codeId} className="mt-6 block text-sm text-ink-soft">
          Verification code
          <input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1.5 block w-full rounded-control bg-paper px-4 py-2 font-extrabold text-[length:var(--text-2xl)] tracking-[0.35em] text-ink tabular-nums ring-1 ring-rule ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-synapse"
          />
        </label>
        {usesMockAuth && <p className="mt-2 mb-0 text-sm text-ink-soft">Test mode: the code is {MOCK_CODE}.</p>}
        <ErrorLine text={error} />
        <Button type="submit" className="mt-8 w-full" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify email"}
        </Button>
      </form>
      <Button variant="text" className="mt-6 -ml-1" onClick={resend}>
        Send a new code
      </Button>
    </Frame>
  );
}
