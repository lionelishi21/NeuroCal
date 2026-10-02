"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { RequestFailed } from "../api/client";
import { useAdminProducts, useProfile } from "../api/queries";
import { useOptionalAuth } from "../auth/AuthProvider";
import { Button } from "../components/Button";
import { SignOutLink } from "../components/SignOutLink";
import { useToast } from "../components/Toast";
import { dietLabel, goalLabel, kcal } from "../lib/format";
import { canInstall, isInstalled, isIos, promptInstall, subscribeToInstall } from "../lib/install";
import { THEMES, type Theme, saveTheme, storedTheme, themeLabel } from "../lib/theme";

const linkClass = "text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink";

/** Profile at a glance, appearance, and the account. Editing the profile reuses the setup steps at /welcome. */
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
    <main className="mx-auto w-full max-w-[34rem] px-4 pt-6 pb-16 sm:px-6 lg:pt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="m-0 text-2xl">Settings</h1>
        <Link href="/" className={`shrink-0 text-sm ${linkClass}`}>
          Back to today
        </Link>
      </div>

      <section aria-labelledby="profile-title" className="mt-8">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 id="profile-title" className="m-0 text-lg">
            Profile
          </h2>
          {(p || needsSetup) && (
            <Link href="/welcome" className={`text-sm ${linkClass}`}>
              {p ? "Edit profile" : "Set up profile"}
            </Link>
          )}
        </div>
        {profile.isPending && <p className="m-0 border-t border-rule pt-3.5 text-ink-soft">Loading your profile…</p>}
        {needsSetup && <p className="m-0 border-t border-rule pt-3.5 text-ink-soft">No profile yet. Set one up to get daily targets.</p>}
        {profile.isError && !needsSetup && (
          <p role="alert" className="m-0 border-t border-rule pt-3.5 text-beet">
            Your profile didn't load. Check your connection and reload the page.
          </p>
        )}
        {p && (
          <dl className="m-0">
            <Row label="Name">{p.displayName}</Row>
            <Row label="Time zone">{(p.timeZone ?? "UTC").replaceAll("_", " ")}</Row>
            <Row label="How you eat">{dietLabel[p.dietaryPreference].name}</Row>
            <Row label="Goals">{p.cognitiveGoals.map((g) => goalLabel[g]).join(", ") || "None chosen"}</Row>
            <Row label="Calories per day">{kcal(p.dailyCalorieTarget)} kcal</Row>
            <Row label="Protein, carbs, fat">
              {p.macroTargets.proteinG} g, {p.macroTargets.carbsG} g, {p.macroTargets.fatG} g
            </Row>
          </dl>
        )}
      </section>

      <section className="mt-10">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-lg font-semibold">Appearance</legend>
          <div className="grid grid-cols-3 gap-1 rounded-pill bg-paper p-1 ring-1 ring-rule ring-inset">
            {THEMES.map((option) => (
              <label key={option} className="relative">
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={theme === option}
                  onChange={() => chooseTheme(option)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-pill py-2 text-center text-sm text-ink-soft peer-checked:bg-rule peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                  {themeLabel[option]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 mb-0 text-sm text-ink-soft">Saved on this device.</p>
        </fieldset>
      </section>

      <AdminLink />

      <InstallApp />

      {auth && (
        <section aria-labelledby="account-title" className="mt-10">
          <h2 id="account-title" className="mt-0 mb-2 text-lg">
            Account
          </h2>
          <dl className="m-0">
            <Row label="Signed in as">{auth.user?.email ?? "Unknown"}</Row>
          </dl>
          <p className="mt-3.5 mb-0">
            <SignOutLink />
          </p>
        </section>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-rule py-3.5 last:border-b">
      <dt className="shrink-0 text-ink-soft">{label}</dt>
      <dd className="m-0 min-w-0 text-right break-words text-ink">{children}</dd>
    </div>
  );
}

/**
 * "Install NeuroCal" where the browser offers a prompt, Share-menu steps on
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
    <section aria-labelledby="install-title" className="mt-10">
      <h2 id="install-title" className="mt-0 mb-2 text-lg">
        Install the app
      </h2>
      <p className="m-0 max-w-[var(--measure)] text-ink-soft">
        {promptReady
          ? "Open NeuroCal from your home screen, full screen, like any other app."
          : "In Safari, tap Share, then Add to Home Screen. NeuroCal then opens full screen, like any other app."}
      </p>
      {promptReady && (
        <Button
          variant="quiet"
          className="mt-3.5"
          onClick={async () => {
            if (await promptInstall()) toast("NeuroCal installed");
          }}
        >
          Install NeuroCal
        </Button>
      )}
    </section>
  );
}

/** "Manage products", shown only to admins (the request is refused for everyone else). */
function AdminLink() {
  const admin = useAdminProducts();
  if (!admin.isSuccess) return null;
  return (
    <section aria-labelledby="admin-title" className="mt-10">
      <h2 id="admin-title" className="mt-0 mb-2 text-lg">
        Admin
      </h2>
      <p className="m-0">
        <Link href="/admin" className={linkClass}>
          Manage products
        </Link>
      </p>
    </section>
  );
}
