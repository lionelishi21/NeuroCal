"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { RequestFailed } from "../api/client";
import { useAdminProducts, useProfile } from "../api/queries";
import { useOptionalAuth } from "../auth/AuthProvider";
import { Button } from "../components/Button";
import { LoadFailed, LoadingLines } from "../components/ListStates";
import { Screen, ScreenHeader, Section, cardClass } from "../components/Screen";
import { SignOutLink } from "../components/SignOutLink";
import { useToast } from "../components/Toast";
import { dietLabel, goalLabel, kcal } from "../lib/format";
import { canInstall, isInstalled, isIos, promptInstall, subscribeToInstall } from "../lib/install";
import { THEME_CHOICES, type Theme, saveTheme, storedTheme } from "../lib/theme";

const outlineLink = "flex h-11 items-center justify-center rounded-pill border-[1.5px] border-rule-strong text-sm font-bold text-synapse-ink no-underline hover:border-ink-soft";

/** "SR" for "Sam Rivera": the first letters of the first two words. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

/** "Europe/London · GMT+1". The offset is left out where the browser can't name it. */
function zoneLine(timeZone: string): string {
  const name = timeZone.replaceAll("_", " ");
  try {
    const offset = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${name} · ${offset}` : name;
  } catch {
    return name;
  }
}

/** Profile at a glance, appearance, installing, and the account. Editing the profile reuses the setup steps at /welcome. */
export function Settings() {
  const profile = useProfile();
  const auth = useOptionalAuth();
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(storedTheme()), []);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    saveTheme(next);
  };

  const p = profile.data;
  const needsSetup = profile.error instanceof RequestFailed && profile.error.status === 404;

  return (
    <Screen>
      <ScreenHeader title="Settings" back={{ href: "/", label: "Back to Today" }} />

      <Section title="Profile" className="[&>h2]:pt-[1.125rem]">
        <div className={`${cardClass} overflow-hidden`}>
          {profile.isPending && (
            <div className="p-4">
              <LoadingLines label="Loading your profile" />
            </div>
          )}
          {needsSetup && (
            <div className="flex flex-col gap-3 p-4">
              <p className="m-0 text-sm text-ink-soft">No profile yet. Set one up to get daily targets.</p>
              <Link href="/welcome" className={outlineLink}>
                Set up profile
              </Link>
            </div>
          )}
          {profile.isError && !needsSetup && (
            <div className="p-4">
              <LoadFailed title="Your profile didn't load" onRetry={() => profile.refetch()}>
                Nothing is lost. Check your connection and try again.
              </LoadFailed>
            </div>
          )}
          {p && (
            <>
              <div className="flex items-center gap-3 p-4">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-synapse-soft text-lg font-extrabold text-synapse-ink">
                  {initials(p.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-lg font-extrabold break-words">{p.displayName}</p>
                  <p className="m-0 text-xs text-ink-soft">{zoneLine(p.timeZone ?? "UTC")}</p>
                </div>
              </div>
              <dl className="m-0">
                <Row label="Diet">{dietLabel[p.dietaryPreference].name}</Row>
                <Row label="Goals">{p.cognitiveGoals.map((g) => goalLabel[g]).join(", ") || "None chosen"}</Row>
                <Row label="Calories">{kcal(p.dailyCalorieTarget)} kcal a day</Row>
                <Row label="Macros">
                  Protein {p.macroTargets.proteinG} g · Carbs {p.macroTargets.carbsG} g · Fat {p.macroTargets.fatG} g
                </Row>
              </dl>
              <div className="border-t border-rule px-4 pt-3 pb-4">
                <Link href="/welcome" className={outlineLink}>
                  Edit profile
                </Link>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Appearance">
        <div role="radiogroup" aria-labelledby="appearance-title" className={`${cardClass} grid grid-cols-3 gap-1 p-1.5`}>
          {THEME_CHOICES.map(([option, label]) => (
            <label key={option} className="relative">
              <input type="radio" name="theme" value={option} checked={theme === option} onChange={() => chooseTheme(option)} className="peer sr-only" />
              <span className="grid h-11 cursor-pointer place-items-center rounded-option text-center text-sm font-bold text-ink peer-checked:bg-synapse peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-synapse">
                {label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      <InstallApp />

      <AdminLink />

      {auth && (
        <Section title="Account">
          <div className={`${cardClass} flex items-center gap-3 py-3.5 pr-3 pl-4`}>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-2xs text-ink-soft">Signed in as</p>
              <p className="m-0 text-md font-bold [overflow-wrap:anywhere]">{auth.user?.email ?? "Unknown"}</p>
            </div>
            <SignOutLink />
          </div>
        </Section>
      )}
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 border-t border-rule px-4 py-3">
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="m-0 text-sm leading-[1.4] font-semibold break-words">{children}</dd>
    </div>
  );
}

const IOS_STEPS = [
  ["Tap ", "Share", " in Safari's toolbar."],
  ["Scroll and tap ", "Add to Home Screen", "."],
  ["Tap ", "Add", " in the top corner."],
] as const;

/**
 * "Install the app" where the browser offers a prompt, Share-menu steps on
 * iPhone and iPad, and nothing where the app is already installed or the
 * browser can't install it.
 */
function InstallApp() {
  const toast = useToast();
  const promptReady = useSyncExternalStore(subscribeToInstall, canInstall, () => false);
  // Read after mount: the server render can't know the device.
  const [device, setDevice] = useState({ installed: false, ios: false });
  useEffect(() => setDevice({ installed: isInstalled(), ios: isIos() }), []);

  if (device.installed || (!promptReady && !device.ios)) return null;
  return (
    <Section title="Install the app">
      <div className={`${cardClass} p-4`}>
        {promptReady ? (
          <>
            <p className="m-0 text-sm text-ink-soft">Open NeuroCal from your home screen, with no browser bar.</p>
            <Button
              className="mt-3 h-12 w-full text-md"
              onClick={async () => {
                if (await promptInstall()) toast("NeuroCal installed");
              }}
            >
              Install the app
            </Button>
          </>
        ) : (
          <>
            <p className="m-0 text-sm text-ink-soft">Add NeuroCal to your home screen in Safari:</p>
            <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
              {IOS_STEPS.map(([before, name, after], i) => (
                <li key={name} className="flex items-center gap-2.5 text-sm leading-[1.4]">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-synapse-soft text-2xs font-extrabold text-synapse-ink">
                    {i + 1}
                  </span>
                  <span>
                    {before}
                    <b className="font-bold">{name}</b>
                    {after}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Section>
  );
}

/** "Manage products", shown only to admins (the request is refused for everyone else). */
function AdminLink() {
  const admin = useAdminProducts();
  if (!admin.isSuccess) return null;
  return (
    <Section title="Admin">
      <Link href="/admin" className={`${cardClass} flex min-h-14 items-center justify-between py-2 pr-3 pl-4 text-ink no-underline hover:border-rule-strong`}>
        <span className="text-md font-bold">Manage products</span>
        <svg viewBox="0 0 24 24" aria-hidden className="size-5 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </Section>
  );
}
