/**
 * NeuroCal's emails, each as a subject, plain text and HTML. The HTML follows the design system's
 * weekly email (design_system/.../NeuroCal Weekly Email.html): a night (#0E1325) header with the
 * wordmark and an amber eyebrow, one message on white, at most one button, and a plain footer.
 * Tables and inline styles only, with Arial, so Gmail, Outlook and Apple Mail all show it the same.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const FONT = "Arial,Helvetica,sans-serif";
const C = {
  page: "#E4E6EE",
  night: "#0E1325",
  white: "#FFFFFF",
  ink: "#121829",
  inkSoft: "#4A5168",
  muted: "#5B6276",
  onNightSoft: "#B4B9CC",
  teal: "#7FD3CF",
  amber: "#E09A2B",
  amberInk: "#A9661A",
  amberSoft: "#FDF3E2",
  rule: "#E1E3EC",
  tile: "#F3F4FA",
  button: "#4F63D9",
  link: "#5B3FD0",
  alert: "#C2412D",
};

/** Text into HTML. Everything that isn't ours (names, addresses) goes through this. */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A block of the body; already HTML. */
type Block = string;

const p = (text: string, opts: { muted?: boolean; size?: number } = {}): Block =>
  `<div style="font-family:${FONT};font-size:${opts.size ?? (opts.muted ? 15 : 16)}px;line-height:${opts.muted ? 22 : 24}px;color:${opts.muted ? C.inkSoft : C.ink};padding-bottom:16px;">${text}</div>`;

/** The amber "next step" panel. */
const callout = (label: string, title: string, text: string): Block =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td style="background:${C.amberSoft};border-radius:12px;padding:24px;">
<div style="font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${C.amberInk};">${label}</div>
<div style="font-family:${FONT};font-size:19px;font-weight:bold;line-height:26px;color:${C.ink};padding-top:8px;">${title}</div>
<div style="font-family:${FONT};font-size:15px;line-height:22px;color:${C.inkSoft};padding-top:6px;">${text}</div>
</td></tr></table>`;

/** Numbered first steps, one row each. */
const steps = (items: [string, string][]): Block =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">${items
    .map(
      ([title, text], i) => `<tr><td width="44" valign="top" style="padding:14px 0;border-bottom:1px solid ${C.rule};"><div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${C.night};color:${C.white};text-align:center;font-family:${FONT};font-size:15px;font-weight:bold;">${i + 1}</div></td>
<td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.rule};font-family:${FONT};"><div style="font-size:16px;font-weight:bold;color:${C.ink};">${title}</div><div style="font-size:15px;line-height:22px;color:${C.inkSoft};padding-top:2px;">${text}</div></td></tr>`,
    )
    .join("")}</table>`;

/** The one-time code, big and easy to read. */
const codeBox = (code: string): Block =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td align="center" style="border:2px solid ${C.rule};border-radius:12px;padding:20px 0;font-family:${FONT};font-size:40px;font-weight:bold;letter-spacing:10px;color:${C.ink};">${code}</td></tr></table>`;

const warning = (text: string): Block =>
  `<div style="font-family:${FONT};font-size:15px;line-height:22px;color:${C.ink};border-top:2px solid ${C.alert};padding-top:14px;margin-bottom:16px;"><span style="color:${C.alert};font-weight:bold;">!</span>&nbsp; ${text}</div>`;

const button = (label: string, href: string): Block =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;"><tr><td align="center" bgcolor="${C.button}" style="background:${C.button};border-radius:10px;"><a href="${escapeHtml(href)}" style="display:block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:${C.white};text-decoration:none;">${label}</a></td></tr></table>`;

function layout(o: {
  /** The grey line mail apps show after the subject. */
  preheader: string;
  eyebrow: string;
  title: string;
  intro?: string;
  body: Block[];
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${o.title}</title>
<style>@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${o.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="px" style="background:${C.night};border-radius:16px 16px 0 0;padding:28px 40px 0 40px;font-family:${FONT};font-size:22px;font-weight:bold;color:${C.white};letter-spacing:-0.5px;">Neuro<span style="color:${C.teal};">Cal</span></td></tr>
<tr><td class="px" style="background:${C.night};padding:32px 40px 36px 40px;">
<div style="font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${C.amber};line-height:18px;">${o.eyebrow}</div>
<div style="font-family:${FONT};font-size:32px;font-weight:bold;line-height:38px;color:${C.white};padding-top:10px;">${o.title}</div>${
    o.intro ? `\n<div style="font-family:${FONT};font-size:16px;line-height:24px;color:${C.onNightSoft};padding-top:12px;">${o.intro}</div>` : ""
  }
</td></tr>
<tr><td class="px" style="background:${C.white};padding:32px 40px 20px 40px;border-radius:0 0 16px 16px;">
${o.body.join("\n")}
</td></tr>
<tr><td align="center" style="padding:24px 40px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">${o.footer}<br>NeuroCal · <a href="https://neurocal.ai" style="color:${C.link};">neurocal.ai</a><br>NeuroCal is not medical advice.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** A sign-up, resend or reset code. [code] may be Cognito's placeholder ("{####}"), filled in by Cognito. */
export function codeEmail(code: string, purpose: "confirm" | "reset", to?: string): RenderedEmail {
  const reset = purpose === "reset";
  const subject = reset ? "Reset your NeuroCal password" : "Your NeuroCal code";
  const lead = reset
    ? "Enter this code in NeuroCal to choose a new password."
    : "Enter this code in NeuroCal to confirm your email and finish creating your account.";
  const after = reset
    ? "Didn't ask for this? Your password hasn't changed. You can ignore this email."
    : "Didn't try to sign up? Ignore this email. Nothing is created until the code is entered.";
  return {
    subject,
    text: [lead, "", code, "", "The code works for a limited time. If it runs out, ask NeuroCal for a new one.", "", after, "", "NeuroCal"].join("\n"),
    html: layout({
      preheader: `${lead} Your code: ${code}`,
      eyebrow: reset ? "Password reset" : "Confirm your email",
      title: reset ? "Reset your password" : "Your code",
      body: [
        p(lead),
        codeBox(code),
        p("The code works for a limited time. If it runs out, ask NeuroCal for a new one.", { muted: true }),
        `<div style="border-top:1px solid ${C.rule};padding-top:16px;">${p(after, { muted: true })}</div>`,
      ],
      footer: to ? `Sent to ${escapeHtml(to)} because someone used this address in NeuroCal.` : "Sent because someone used this address in NeuroCal.",
    }),
  };
}

/** After onboarding: the first score arrives tomorrow, and three things make it accurate. */
export function welcomeEmail(o: { to: string; name: string; kcal: number; proteinG: number; carbsG: number; fatG: number }): RenderedEmail {
  const first = o.name.trim().split(/\s+/)[0] ?? "";
  const hello = first ? `Welcome, ${first}.` : "Welcome to NeuroCal.";
  const items: [string, string][] = [
    ["Log your next meal", "Take a photo before you eat. NeuroCal works out the calories and macros."],
    ["Check in this afternoon", "Pick how you feel: sharp, foggy, wired or calm. It takes five seconds."],
    ["Log tonight's sleep", "When you wake, log when you went to sleep and when you got up, or connect your phone's sleep."],
  ];
  const targets = `Your targets: ${o.kcal.toLocaleString("en-GB")} kcal, ${Math.round(o.proteinG)} g protein, ${Math.round(o.carbsG)} g carbs, ${Math.round(o.fatG)} g fat. Change them any time in Settings.`;
  return {
    subject: first ? `Welcome to NeuroCal, ${first}` : "Welcome to NeuroCal",
    text: [
      hello,
      "",
      "Your first Focus Score arrives tomorrow morning. Three things to do today make it accurate:",
      ...items.map(([t, d], i) => `${i + 1}. ${t}: ${d}`),
      "",
      targets,
      "",
      "NeuroCal",
    ].join("\n"),
    html: layout({
      preheader: "Your first Focus Score arrives tomorrow morning. Three things to do today make it accurate.",
      eyebrow: "Welcome",
      title: escapeHtml(hello),
      intro: "Your first Focus Score arrives tomorrow morning. Three things to do today make it accurate.",
      body: [steps(items), p(targets, { muted: true })],
      footer: `Sent to ${escapeHtml(o.to)} because you created a NeuroCal account.`,
    }),
  };
}

/** Joined the waitlist: one email now, one the day the app is out. */
export function waitlistEmail(o: { to: string; unsubscribeUrl: string }): RenderedEmail {
  return {
    subject: "You're on the NeuroCal list",
    text: [
      "Thanks for signing up.",
      "",
      "NeuroCal is coming to iPhone and Android. We'll email you once, the day it's ready to download, with the link.",
      "",
      `Changed your mind, or didn't sign up? Unsubscribe here: ${o.unsubscribeUrl}`,
      "",
      "NeuroCal",
    ].join("\n"),
    html: layout({
      preheader: "We'll email you once, the day NeuroCal is ready to download.",
      eyebrow: "You're on the list",
      title: "Thanks for signing up.",
      intro: "Lose weight and think clearer, with one Focus Score each morning.",
      body: [
        p("NeuroCal is coming to iPhone and Android. We'll email you once, the day it's ready to download, with the link."),
        callout(
          "What you'll get",
          "A daily Focus Score for your brain.",
          "It comes from your food, sleep, fasting, coffee and how you feel, and tells you the one thing to change today.",
        ),
      ],
      footer: `Sent to ${escapeHtml(o.to)}. <a href="${escapeHtml(o.unsubscribeUrl)}" style="color:${C.link};">Unsubscribe</a> if you changed your mind or didn't sign up.`,
    }),
  };
}

/** Two days before a free trial turns paid. */
export function trialEndingEmail(o: { to: string; day: string }): RenderedEmail {
  return {
    subject: `Your NeuroCal trial ends on ${o.day}`,
    text: [
      "Hi,",
      "",
      `A reminder that your free trial of NeuroCal ends on ${o.day}.`,
      "",
      "To keep going, there's nothing to do: your subscription starts then, at the price you saw when you started the trial.",
      "",
      "If you'd rather not continue, cancel before then and you won't be charged:",
      "- iPhone: Settings > your name > Subscriptions > NeuroCal",
      "- Android: Google Play > your profile > Payments & subscriptions > Subscriptions > NeuroCal",
      "",
      "Deleting the app doesn't cancel the subscription.",
      "",
      "NeuroCal",
    ].join("\n"),
    html: layout({
      preheader: `Your free trial ends on ${o.day}. Nothing to do to keep going.`,
      eyebrow: "Your free trial",
      title: `Your trial ends on ${o.day}`,
      body: [
        p("To keep going, there's nothing to do: your subscription starts then, at the price you saw when you started the trial."),
        callout(
          "Rather not continue?",
          "Cancel before then and you won't be charged.",
          "iPhone: Settings &gt; your name &gt; Subscriptions &gt; NeuroCal.<br>Android: Google Play &gt; your profile &gt; Payments &amp; subscriptions &gt; Subscriptions &gt; NeuroCal.",
        ),
        p("Deleting the app doesn't cancel the subscription.", { muted: true }),
      ],
      footer: `Sent to ${escapeHtml(o.to)} because your NeuroCal trial is ending.`,
    }),
  };
}

/** Confirms a deleted account; the last email to that address. */
export function accountDeletedEmail(o: { to: string; when: string; signUpUrl?: string }): RenderedEmail {
  const what = `On ${o.when} we deleted the NeuroCal account for ${o.to}, along with every meal, sleep log, check-in and photo in it.`;
  return {
    subject: "Your NeuroCal account has been deleted",
    text: [
      what,
      "",
      "This can't be undone. Backups clear within 14 days. You can create a new account any time.",
      "",
      "Didn't do this? Reply to this email straight away and we'll look into it.",
      "",
      "NeuroCal",
    ].join("\n"),
    html: layout({
      preheader: "Your account and everything in it are gone. This is the last email we'll send you.",
      eyebrow: "Account deleted",
      title: "Your account has been deleted",
      body: [
        p(escapeHtml(what)),
        p("This can't be undone. Backups clear within 14 days. You can create a new account any time.", { muted: true }),
        ...(o.signUpUrl ? [button("Create a new account", o.signUpUrl)] : []),
        warning("Didn't do this? Reply to this email straight away and we'll look into it."),
      ],
      footer: "This is the last email we'll send to this address.",
    }),
  };
}
