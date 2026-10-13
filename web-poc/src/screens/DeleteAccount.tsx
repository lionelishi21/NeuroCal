import { SiteFrame } from "../components/SiteFrame";

const DELETED = ["Your profile and bio-profile answers", "Meals, meal photos and check-ins", "Focus Scores, sleep and screen time", "Your sign-in, and your waitlist entry if you had one"];

/**
 * How to delete a NeuroCal account. Google Play asks for a web page that says this, for people
 * who no longer have the app installed.
 */
export function DeleteAccount() {
  return (
    <SiteFrame>
      <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">Delete your NeuroCal account</h1>
      <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">In the app, open Settings and tap Delete account, then confirm. It takes effect straight away.</p>

      <h2 className="mt-7 mb-2 text-lg font-extrabold">What gets deleted</h2>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-base text-ink-soft">
        {DELETED.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 mb-0 text-base leading-normal text-pretty text-ink-soft">Everything is deleted straight away and can&rsquo;t be recovered. Our database backups, kept for 14 days in case of a failure, roll over after that, so nothing is left after 14 days.</p>

      <h2 className="mt-7 mb-2 text-lg font-extrabold">No longer have the app?</h2>
      <p className="m-0 text-base leading-normal text-pretty text-ink-soft">
        Email{" "}
        <a href="mailto:hello@neurocal.ai?subject=Delete%20my%20account" className="font-bold text-synapse-ink underline-offset-4 hover:underline">
          hello@neurocal.ai
        </a>{" "}
        from the address you signed up with, and we&rsquo;ll delete the account within 30 days and tell you when it&rsquo;s done.
      </p>
    </SiteFrame>
  );
}
