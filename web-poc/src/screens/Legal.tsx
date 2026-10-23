import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFrame } from "../components/SiteFrame";

/**
 * Facts only the business can fill in. While any is still a placeholder, the pages say they are a
 * draft. Have a lawyer review both pages before launch.
 */
export const LEGAL = {
  company: "[Company legal name]",
  address: "[Registered address]",
  governingLaw: "[State or country whose law governs]",
  minimumAge: 16,
  contact: "hello@neurocal.ai",
  updated: "13 October 2026",
};

const isDraft = Object.values(LEGAL).some((v) => typeof v === "string" && v.startsWith("["));

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <SiteFrame wide>
      {isDraft && (
        <p role="note" className="mt-0 mb-6 rounded-option bg-glucose-soft px-4 py-3 text-sm font-semibold text-glucose-ink">
          Draft: not yet in effect. Details in brackets are still to be filled in.
        </p>
      )}
      <h1 className="m-0 text-3xl leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">{title}</h1>
      <p className="mt-2 mb-0 text-sm text-ink-soft">Last updated {LEGAL.updated}</p>
      <div className="mt-5 text-base leading-relaxed text-pretty text-ink-soft">{intro}</div>
      {sections.map((s, i) => (
        <section key={s.title} aria-labelledby={`legal-${i}`} className="mt-8">
          <h2 id={`legal-${i}`} className="m-0 text-lg font-extrabold text-ink">
            {i + 1}. {s.title}
          </h2>
          <div className="mt-2 flex flex-col gap-3 text-base leading-relaxed text-pretty text-ink-soft [&_li]:mt-1.5 [&_ul]:m-0 [&_ul]:pl-5 [&_ul]:list-disc">
            {s.body}
          </div>
        </section>
      ))}
      <p className="mt-10 mb-0 text-sm text-ink-soft">
        Questions? Email{" "}
        <a href={`mailto:${LEGAL.contact}`} className="font-bold text-synapse-ink underline-offset-4 hover:underline">
          {LEGAL.contact}
        </a>
        .
      </p>
    </SiteFrame>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-bold text-synapse-ink underline-offset-4 hover:underline">
    {children}
  </Link>
);

export function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p className="m-0">
          NeuroCal helps you eat for how you want to think. To do that it needs to know what you eat, how you sleep and how you feel. This page says what we
          collect, why, who else sees it, how long we keep it, and how to delete it. NeuroCal is run by {LEGAL.company}, {LEGAL.address} (&ldquo;we&rdquo;).
        </p>
      }
      sections={[
        {
          title: "What we collect",
          body: (
            <ul>
              <li>Your email address and sign-in details, to run your account.</li>
              <li>Your profile and onboarding answers: name, time zone, diet, goals, sleep and caffeine habits, supplements, and a weight goal if you set one.</li>
              <li>
                Health conditions you choose to tell us about (for example diabetes, a heart condition or pregnancy). We use them only to make your plan more
                cautious: gentler fasting, no weight-loss goal where it isn&rsquo;t right, and suggestions that suit you. You can change or remove them in the
                app at any time.
              </li>
              <li>
                What you log: meals and their nutrition; photos of meals, food packages, supplement labels and shopping lists; barcodes you scan; check-ins about
                how you feel; sleep, screen time, weigh-ins, exercise, planned fasts, Brain speed reaction times, your supplement stack, your pantry, and
                readings you type in such as blood pressure or lab results.
              </li>
              <li>
                With your permission, data from Apple Health or Health Connect: sleep, resting heart rate, heart rate variability, blood pressure and, if you use
                one, a daily summary from your glucose sensor. You can turn this off in your phone&rsquo;s settings.
              </li>
              <li>If you set your town for air quality: the town, rounded to about 10 km.</li>
              <li>
                How the app is used (which screens and buttons, for example &ldquo;onboarding finished&rdquo; or &ldquo;meal logged&rdquo;), tied to an
                account number, never to your health values; and crash reports with no personal details. Both only when they&rsquo;re switched on.
              </li>
              <li>Your subscription status (trial, active or ended), from the app store, through RevenueCat.</li>
              <li>If you join the waitlist on our website: your email address and which phone you use.</li>
            </ul>
          ),
        },
        {
          title: "What we don't do",
          body: (
            <ul>
              <li>We don't sell your personal information or share it for advertising.</li>
              <li>We don&rsquo;t use advertising trackers, and our usage analytics never include your health information.</li>
              <li>We never use your health conditions or health data for anything but running your plan.</li>
              <li>We don&rsquo;t see your payment details: Apple or Google handle payment.</li>
              <li>Progress photos stay on your phone: they&rsquo;re never uploaded to us.</li>
            </ul>
          ),
        },
        {
          title: "Why we use it",
          body: (
            <p className="m-0">
              To provide the app: work out your calories, Focus Score, fasting timer and weight trend; read your photos; suggest what to eat next; and keep your
              subscription working. We rely on our contract with you to provide the service you signed up for and, for the health information you choose to log,
              on your explicit consent, which you can withdraw at any time by deleting the information or your account.
            </p>
          ),
        },
        {
          title: "Who else sees it",
          body: (
            <>
              <p className="m-0">Only the services we need to run NeuroCal, each under a contract that limits them to doing that work for us:</p>
              <ul>
                <li>Amazon Web Services: hosting, sign-in and storage, in the United States.</li>
                <li>OpenAI: reads photos of meals, food packages, supplement labels and shopping lists to identify what&rsquo;s in them.</li>
                <li>
                  Anthropic: writes your Focus Score explanation, recipes, meal plans, shopping list reviews and better food choices, from your day&rsquo;s
                  numbers, your pantry, your food preferences and any food rules that follow from health conditions you&rsquo;ve told us about. They receive no
                  name or email.
                </li>
                <li>A recipe search service (Tavily): receives only the search phrase, never anything about you.</li>
                <li>Open Food Facts: receives the barcodes you scan, to look up the product.</li>
                <li>Open-Meteo: receives the town you set, to find its air quality.</li>
                <li>PostHog: records how the app is used, as described above, if analytics is switched on.</li>
                <li>Sentry: records app and server crashes, without personal details, if crash reporting is switched on.</li>
                <li>RevenueCat, Apple and Google: process and record your subscription.</li>
                <li>Resend: sends waitlist and account emails.</li>
              </ul>
              <p className="m-0">Under their terms for business customers, OpenAI and Anthropic don&rsquo;t use what we send them to train their models.</p>
              <p className="m-0">We may also disclose information if the law requires it, or to protect someone&rsquo;s safety.</p>
            </>
          ),
        },
        {
          title: "How long we keep it",
          body: (
            <ul>
              <li>Meal and label photos: deleted automatically 30 days after upload. The foods read from them stay with your meals.</li>
              <li>Progress photos, glasses of water and other things kept on your phone: until you delete them or the app.</li>
              <li>Everything else in your account: until you delete it or your account.</li>
              <li>Database backups, kept in case of a failure, roll over after 14 days, so deleted information is gone from them within 14 days.</li>
              <li>Waitlist entries: until you unsubscribe or join the app.</li>
            </ul>
          ),
        },
        {
          title: "Your choices and rights",
          body: (
            <>
              <ul>
                <li>Delete a meal, check-in, weigh-in, exercise or reading at any time in the app, and change or remove your health conditions in Me.</li>
                <li>
                  Delete your whole account in the app (Settings, Delete account), or see <A href="/delete-account">how to delete your account</A>.
                </li>
                <li>Ask for a copy of your information, or to correct it, by emailing {LEGAL.contact}. We answer within 30 days.</li>
              </ul>
              <p className="m-0">
                Depending on where you live (for example the EU, the UK or California), you may have further rights, including to object to how we use your
                information or to complain to your data protection authority. Email us and we&rsquo;ll help.
              </p>
            </>
          ),
        },
        {
          title: "Security",
          body: (
            <p className="m-0">
              Your information is encrypted in transit and at rest, photos are stored privately, and each account can only reach its own data. No system is
              perfectly secure; if a breach affects you, we&rsquo;ll tell you as the law requires.
            </p>
          ),
        },
        {
          title: "Children",
          body: (
            <p className="m-0">
              NeuroCal isn&rsquo;t for anyone under {LEGAL.minimumAge}. If you believe a child has given us information, email us and we&rsquo;ll delete it.
            </p>
          ),
        },
        {
          title: "Changes",
          body: (
            <p className="m-0">If we change this policy in a way that matters, we&rsquo;ll tell you in the app or by email before the change takes effect.</p>
          ),
        },
      ]}
    />
  );
}

export function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      intro={
        <p className="m-0">
          These terms are the agreement between you and {LEGAL.company} (&ldquo;we&rdquo;) for using NeuroCal. By creating an account you accept them. Please
          also read our <A href="/privacy">privacy policy</A>.
        </p>
      }
      sections={[
        {
          title: "NeuroCal isn't medical advice",
          body: (
            <>
              <p className="m-0">
                NeuroCal gives general information about food, sleep, fasting and supplements. It doesn&rsquo;t diagnose, treat or prevent any condition, and it
                isn&rsquo;t a substitute for a doctor, dietitian or pharmacist.
              </p>
              <p className="m-0">
                Talk to a doctor before you change how you eat, start fasting or take a supplement, especially if you are pregnant or breastfeeding, take
                medication (in particular for diabetes or blood pressure), have a medical condition, or have had an eating disorder. Stop and get help if you feel
                unwell.
              </p>
              <p className="m-0">
                Planned fasts are limited to 48 hours from your last meal, less with some health conditions. Fasts over 24 hours are for healthy adults only;
                drink water throughout and stop if you feel dizzy, faint or unwell.
              </p>
              <p className="m-0">
                Nutrition figures, photo readings and label readings are estimates and can be wrong. A label reading, including whether a coffee says it&rsquo;s
                tested for mould toxins, reports what the label says; it isn&rsquo;t a test of what&rsquo;s in the product.
              </p>
            </>
          ),
        },
        {
          title: "Your account",
          body: (
            <p className="m-0">
              You must be at least {LEGAL.minimumAge} to use NeuroCal. Keep your sign-in details private; you&rsquo;re responsible for what happens in your
              account. You can delete your account at any time in the app.
            </p>
          ),
        },
        {
          title: "Subscriptions, trials and cancelling",
          body: (
            <ul>
              <li>Most of NeuroCal needs a subscription. You buy it through the App Store or Google Play, and their terms apply to payment.</li>
              <li>
                Where a free trial is offered, you are charged when it ends unless you cancel at least 24 hours before. You can cancel during the trial at no
                charge. We email you two days before a trial ends.
              </li>
              <li>Subscriptions renew automatically at the then-current price until you cancel. Cancel any time in your App Store or Google Play subscriptions; you keep access until the end of the period you paid for.</li>
              <li>Deleting your account doesn&rsquo;t cancel your subscription: cancel it in the store too.</li>
              <li>Refunds are handled by Apple or Google under their policies.</li>
              <li>If we change the price, we&rsquo;ll tell you in advance, and the store will ask for your agreement where required.</li>
            </ul>
          ),
        },
        {
          title: "Products we suggest",
          body: (
            <p className="m-0">
              NeuroCal may suggest products, labelled as they appear. &ldquo;Our brand&rdquo; products are sold by MitoProof, which is run by the people who make
              NeuroCal. For products marked &ldquo;Affiliate link&rdquo;, we may earn a commission if you buy. Products are sold by their makers or shops, not by
              us, and their terms apply.
            </p>
          ),
        },
        {
          title: "Using NeuroCal fairly",
          body: (
            <p className="m-0">
              Don&rsquo;t misuse the service: no breaking into other accounts or our systems, no automated scraping, no reverse engineering except where the law
              allows it, and no uploading content that is illegal or isn&rsquo;t yours to upload. We may suspend accounts that do.
            </p>
          ),
        },
        {
          title: "Your content",
          body: (
            <p className="m-0">
              What you log and the photos you upload stay yours. You let us store and process them only to run NeuroCal for you, as our privacy policy describes.
            </p>
          ),
        },
        {
          title: "Changes to NeuroCal and these terms",
          body: (
            <p className="m-0">
              We may change or stop features. If we change these terms in a way that matters, we&rsquo;ll tell you before it takes effect; carrying on using
              NeuroCal after that means you accept the new terms.
            </p>
          ),
        },
        {
          title: "Liability",
          body: (
            <p className="m-0">
              We work to keep NeuroCal accurate and available but can&rsquo;t promise it will always be either. To the extent the law allows, we aren&rsquo;t
              liable for indirect or consequential losses, and our total liability to you is limited to what you paid us in the 12 months before the claim.
              Nothing in these terms limits liability that can&rsquo;t be limited by law, or your rights as a consumer.
            </p>
          ),
        },
        {
          title: "Law and contact",
          body: (
            <p className="m-0">
              These terms are governed by the law of {LEGAL.governingLaw}, without affecting any mandatory consumer protections where you live. To reach us,
              email {LEGAL.contact} or write to {LEGAL.company}, {LEGAL.address}.
            </p>
          ),
        },
      ]}
    />
  );
}
