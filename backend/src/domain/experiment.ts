/**
 * Supplements as personal experiments (docs/NCBM.md): what each ingredient is for, how long it takes,
 * how strong the evidence is and what to expect, in plain words and never as a promised percentage;
 * then whether it's working for this person, from their own data. The four weeks before they started
 * are compared with the time since it had a chance to work, on the measure that fits its purpose:
 * Brain speed for focus and energy, the sleep and stress parts of the Focus Score for those. It's a
 * personal guide, not proof: other changes move the same numbers.
 */

export type Purpose = "sleep" | "focus" | "energy" | "stress" | "long_term";
export type Evidence = "strong" | "some" | "early";

export interface IngredientProfile {
  /** As we name it: "Magnesium". */
  name: string;
  purpose: Purpose;
  /** Days before an effect can show. */
  onsetDays: number;
  evidence: Evidence;
  /** What to expect, honestly sized. */
  expectation: string;
}

const KNOWN: (IngredientProfile & { match: RegExp })[] = [
  {
    name: "Magnesium",
    match: /magnesium/,
    purpose: "sleep",
    onsetDays: 14,
    evidence: "some",
    expectation: "May help you fall asleep and sleep more deeply, most of all if you're low in magnesium. Give it two weeks.",
  },
  { name: "Glycine", match: /glycine/, purpose: "sleep", onsetDays: 3, evidence: "some", expectation: "3 g before bed may help you fall asleep faster and feel less tired the next day." },
  {
    name: "Melatonin",
    match: /melatonin/,
    purpose: "sleep",
    onsetDays: 1,
    evidence: "strong",
    expectation: "Helps you fall asleep sooner, by minutes rather than hours; best for jet lag or a late body clock. The lowest dose that works is best.",
  },
  { name: "Apigenin", match: /apigenin|chamomile/, purpose: "sleep", onsetDays: 7, evidence: "early", expectation: "A mild calming effect before bed for some people; small studies only." },
  {
    name: "Caffeine",
    match: /caffeine|guarana|coffee (bean|fruit)|green tea extract|yerba mate/,
    purpose: "focus",
    onsetDays: 1,
    evidence: "strong",
    expectation: "Sharper reactions within the hour. Taken late, it costs deep sleep.",
  },
  { name: "L-theanine", match: /theanine/, purpose: "focus", onsetDays: 1, evidence: "some", expectation: "Calmer focus within the hour, most noticeably alongside caffeine." },
  {
    name: "Creatine",
    match: /creatine/,
    purpose: "focus",
    onsetDays: 21,
    evidence: "some",
    expectation: "Builds up over three to four weeks: more strength, and steadier thinking when you're short of sleep.",
  },
  { name: "Citicoline", match: /citicoline|cdp[- ]?choline|alpha[- ]?gpc|glycerophosphocholine/, purpose: "focus", onsetDays: 7, evidence: "early", expectation: "Choline for the brain; small studies suggest a modest lift in attention." },
  { name: "Bacopa", match: /bacopa/, purpose: "focus", onsetDays: 56, evidence: "some", expectation: "Better memory after 8 to 12 weeks, not before. It won't sharpen you today." },
  { name: "Lion's mane", match: /lion'?s mane|hericium/, purpose: "focus", onsetDays: 28, evidence: "early", expectation: "Early studies hint at better memory and mood after a month or more." },
  { name: "Rhodiola", match: /rhodiola/, purpose: "energy", onsetDays: 7, evidence: "early", expectation: "May ease mental fatigue under stress within a week or two." },
  { name: "Ginseng", match: /ginseng|panax/, purpose: "energy", onsetDays: 14, evidence: "early", expectation: "A small lift in energy and calm for some people; results vary." },
  {
    name: "NAD+",
    match: /\bnad\b|nad\+|nicotinamide (riboside|mononucleotide)|\bnmn\b|\bnr\b/,
    purpose: "energy",
    onsetDays: 28,
    evidence: "early",
    expectation: "Raises NAD+ in the blood. Effects on energy and performance in people are small or unproven so far, so your own data matters most.",
  },
  { name: "CoQ10", match: /coq10|ubiquinol|ubiquinone|coenzyme q/, purpose: "energy", onsetDays: 28, evidence: "early", expectation: "Supports how cells make energy; clearer benefits for people on statins or with low levels." },
  { name: "Vitamin B12", match: /b12|cobalamin|b[- ]?complex/, purpose: "energy", onsetDays: 28, evidence: "some", expectation: "More energy if you were low (common on plant-based diets); little change if you weren't." },
  { name: "Iron", match: /\biron\b|ferrous|ferric/, purpose: "energy", onsetDays: 56, evidence: "some", expectation: "Less tiredness if you were low in iron; only take it if a blood test says so." },
  { name: "Electrolytes", match: /electrolyte|sodium chloride|potassium (citrate|chloride)/, purpose: "energy", onsetDays: 1, evidence: "some", expectation: "Fewer fasting headaches and less fatigue, especially on low-carb days." },
  { name: "Ashwagandha", match: /ashwagandha|withania/, purpose: "stress", onsetDays: 28, evidence: "some", expectation: "Lower stress and better sleep for some people after four to eight weeks." },
  { name: "Omega-3", match: /omega[- ]?3|fish oil|\bepa\b|\bdha\b|krill/, purpose: "long_term", onsetDays: 84, evidence: "some", expectation: "Heart and brain support over months; you won't feel it day to day." },
  { name: "Vitamin D", match: /vitamin d|cholecalciferol|\bd3\b/, purpose: "long_term", onsetDays: 56, evidence: "strong", expectation: "Corrects a shortfall over a couple of months; worth a blood test to know your level." },
  { name: "Probiotics", match: /probiotic|lactobacill|bifidobacter|boulardii|\bcfu\b/, purpose: "long_term", onsetDays: 28, evidence: "early", expectation: "Effects depend on the strain and are mostly on digestion; give it four weeks." },
  { name: "Urolithin A", match: /urolithin/, purpose: "long_term", onsetDays: 56, evidence: "early", expectation: "Aimed at muscle and mitochondria over months; early but promising human studies." },
  { name: "Spermidine", match: /spermidine/, purpose: "long_term", onsetDays: 84, evidence: "early", expectation: "Studied for healthy ageing over months and years; no effect you'll feel." },
  { name: "Berberine", match: /berberine/, purpose: "long_term", onsetDays: 28, evidence: "some", expectation: "Lowers blood sugar over weeks; check with your doctor if you take diabetes medicine." },
  { name: "Zinc", match: /\bzinc\b/, purpose: "long_term", onsetDays: 28, evidence: "some", expectation: "Fixes a shortfall; too much for long blocks copper." },
];

export interface SupplementProfile {
  /** What it's mostly for; null when no ingredient is known. */
  purpose: Purpose | null;
  /** Days before the main effect can show. */
  onsetDays: number;
  /** The known ingredients, in the order of the list above (by purpose), not label order. */
  ingredients: IngredientProfile[];
}

/** What a stack item is for, from its name and ingredients. A blend takes the purpose most of its known ingredients share. */
export function profileOf(item: { name: string; ingredients: { name: string }[] }): SupplementProfile {
  const texts = [item.name, ...item.ingredients.map((i) => i.name)].map((t) => t.toLowerCase());
  const found = KNOWN.filter((k) => texts.some((t) => k.match.test(t))).map(({ match: _, ...p }) => p);
  if (found.length === 0) return { purpose: null, onsetDays: 14, ingredients: [] };
  // Short-term purposes outvote long-term ones, which have no daily measure.
  const counts = new Map<Purpose, number>();
  for (const f of found) counts.set(f.purpose, (counts.get(f.purpose) ?? 0) + (f.purpose === "long_term" ? 0.5 : 1));
  const purpose = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const onsetDays = Math.max(...found.filter((f) => f.purpose === purpose).map((f) => f.onsetDays));
  return { purpose, onsetDays, ingredients: found };
}

/** The daily number an experiment compares, by purpose. Unknown items are judged by Brain speed. */
export type Measure = "brain_speed" | "sleep" | "stress";
export const measureFor = (purpose: Purpose | null): Measure | null =>
  purpose === "long_term" ? null : purpose === "sleep" ? "sleep" : purpose === "stress" ? "stress" : "brain_speed";

export type Verdict =
  | "long_term"
  | "building"
  | "need_baseline"
  | "too_early"
  | "helping"
  | "no_change"
  | "worse"
  // After stopping: still watching, the gain lasted, or it faded.
  | "watching"
  | "lasted"
  | "faded";
export type Feeling = "better" | "same" | "worse";

export interface Experiment {
  measure: Measure | null;
  /** Days since it was added; 1 on the first day. */
  day: number;
  onsetDays: number;
  /** Means on the measure's 0–100 scale, and how many days each has. */
  before: { mean: number; days: number } | null;
  /** Since it had time to work; after stopping, since it was stopped. */
  since: { mean: number; days: number } | null;
  /** After stopping: while it was being taken. */
  during?: { mean: number; days: number } | null;
  /** since − before, in points; null until there's a verdict. */
  change: number | null;
  verdict: Verdict;
  /** One or two plain sentences for the person. */
  summary: string;
  /** Days ticked as taken since it had time to work, out of the days since. */
  taken: { days: number; of: number } | null;
  /** Ask how they feel: at two weeks and four, unless already answered since. */
  askFeeling: boolean;
  /** Their latest answer, if any. */
  feeling: Feeling | null;
}

/** Days before and after each needs at least this many measured days for a verdict. */
export const MIN_DAYS = 4;
/** The window before starting. */
export const BEFORE_DAYS = 28;
/** The smallest change worth calling, per measure, in points on the 0–100 scale. */
const MIN_CHANGE: Record<Measure, number> = { brain_speed: 3, sleep: 5, stress: 10 };

const LABEL: Record<Measure, string> = { brain_speed: "Brain speed", sleep: "sleep score", stress: "stress score" };
const DAY_MS = 86_400_000;
const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/**
 * The experiment for one supplement. [series]: the measure by local date (0–100); [doses]: dates ticked
 * as taken; [feelings]: answers by date. [added] and [today] are local dates.
 */
export function experimentOf(o: {
  name: string;
  profile: SupplementProfile;
  added: string;
  today: string;
  series: Map<string, number>;
  doses: string[];
  feelings: { date: string; feeling: Feeling }[];
}): Experiment {
  const { profile, name } = o;
  const measure = measureFor(profile.purpose);
  const day = dayIndex(o.today) - dayIndex(o.added) + 1;
  const onset = profile.onsetDays;
  const latest = [...o.feelings].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
  const answeredSince = (d: number) => latest !== null && dayIndex(latest.date) - dayIndex(o.added) + 1 >= d;
  const askFeeling = (day >= 28 && !answeredSince(28)) || (day >= 14 && day < 28 && !answeredSince(14));
  const base = { measure, day, onsetDays: onset, askFeeling, feeling: latest?.feeling ?? null };

  if (measure === null) {
    return {
      ...base,
      before: null,
      since: null,
      change: null,
      taken: null,
      verdict: "long_term",
      summary: `${name} works over months, not days, so there's no daily number to watch. Keep taking it and check in on how you feel.`,
    };
  }
  const start = dayIndex(o.added);
  const from = start + Math.max(0, onset - 1);
  const values = [...o.series.entries()].map(([d, v]) => ({ i: dayIndex(d), v }));
  const before = values.filter((x) => x.i >= start - BEFORE_DAYS && x.i < start).map((x) => x.v);
  const since = values.filter((x) => x.i >= from && x.i <= dayIndex(o.today)).map((x) => x.v);
  const sinceDays = Math.max(0, dayIndex(o.today) - from + 1);
  const doseDays = new Set(o.doses.filter((d) => dayIndex(d) >= from && dayIndex(d) <= dayIndex(o.today)));
  const taken = sinceDays > 0 ? { days: doseDays.size, of: sinceDays } : null;
  const stat = (xs: number[]) => (xs.length ? { mean: Math.round(mean(xs) * 10) / 10, days: xs.length } : null);
  const result = { ...base, before: stat(before), since: stat(since), taken };
  const label = LABEL[measure];

  if (day < onset) {
    return {
      ...result,
      change: null,
      verdict: "building",
      summary: `Day ${day} of about ${onset} before ${name} can show. Keep taking it${measure === "brain_speed" ? " and do a Brain speed check most days" : ""}.`,
    };
  }
  if (before.length < MIN_DAYS) {
    return {
      ...result,
      change: null,
      verdict: "need_baseline",
      summary:
        measure === "brain_speed"
          ? `There aren't enough Brain speed checks from before you started ${name} to compare with. Keep checking: a week off it later would show the difference.`
          : `There isn't enough ${label} from before you started ${name} to compare with. Keep logging: a week off it later would show the difference.`,
    };
  }
  if (since.length < MIN_DAYS) {
    const more = MIN_DAYS - since.length;
    return {
      ...result,
      change: null,
      verdict: "too_early",
      summary:
        measure === "brain_speed"
          ? `${more} more Brain speed ${more === 1 ? "check" : "checks"} and NeuroCal can tell whether ${name} is working for you.`
          : `${more} more ${more === 1 ? "day" : "days"} of ${label} and NeuroCal can tell whether ${name} is working for you.`,
    };
  }
  const change = Math.round((mean(since) - mean(before)) * 10) / 10;
  // A change counts when it's past the smallest worth calling and past the day-to-day noise.
  const noise = 0.5 * sd(before);
  const real = Math.abs(change) >= Math.max(MIN_CHANGE[measure], noise);
  const verdict: Verdict = !real ? "no_change" : change > 0 ? "helping" : "worse";
  const shown = (n: number) => Math.round(n);
  const spotty = taken && taken.of >= 7 && taken.days / taken.of < 0.7 ? ` You ticked it on ${taken.days} of ${taken.of} days, so this is less certain.` : "";
  const summary =
    verdict === "helping"
      ? `Since starting ${name}, your ${label} is up ${shown(change)} (from ${shown(mean(before))} to ${shown(mean(since))}).${spotty}`
      : verdict === "worse"
        ? `Since starting ${name}, your ${label} is down ${shown(-change)} (from ${shown(mean(before))} to ${shown(mean(since))}). Worth trying a different one, or another time of day.${spotty}`
        : `No clear change in your ${label} since starting ${name}.${spotty} If it still isn't helping after another couple of weeks, try a different form or brand.`;
  return { ...result, change, verdict, summary };
}

/** Days left out after stopping, while it wears off. */
export const WASH_OUT_DAYS = 3;
/** How long after stopping NeuroCal keeps watching. */
export const WATCH_AFTER_STOP_DAYS = 28;

/**
 * After stopping a supplement: did the gain last? Before it, while taking it (from when it could work)
 * and since stopping (after a few days to wear off) are compared on its measure. A gain that held is
 * "lasted": maybe it isn't needed any more. One that went back is "faded": it works while taken.
 */
export function afterStopOf(o: {
  name: string;
  profile: SupplementProfile;
  added: string;
  stopped: string;
  today: string;
  series: Map<string, number>;
}): Experiment {
  const { name, profile } = o;
  const measure = measureFor(profile.purpose);
  const dayIdx = dayIndex;
  const sinceStop = dayIdx(o.today) - dayIdx(o.stopped);
  const base = { measure, day: sinceStop + 1, onsetDays: profile.onsetDays, taken: null, askFeeling: false, feeling: null, change: null };
  if (measure === null) {
    return { ...base, before: null, since: null, verdict: "long_term", summary: `You stopped ${name}. It works over months, so there's no daily number to watch.` };
  }
  const label = LABEL[measure];
  const start = dayIdx(o.added);
  const stop = dayIdx(o.stopped);
  const values = [...o.series.entries()].map(([d, v]) => ({ i: dayIdx(d), v }));
  const pick = (from: number, to: number) => values.filter((x) => x.i >= from && x.i <= to).map((x) => x.v);
  const before = pick(start - BEFORE_DAYS, start - 1);
  const during = pick(start + Math.max(0, profile.onsetDays - 1), stop - 1);
  const after = pick(stop + WASH_OUT_DAYS, Math.min(dayIdx(o.today), stop + WATCH_AFTER_STOP_DAYS));
  const stat = (xs: number[]) => (xs.length ? { mean: Math.round(mean(xs) * 10) / 10, days: xs.length } : null);
  const shown = { ...base, before: stat(before), during: stat(during), since: stat(after) };
  if (after.length < MIN_DAYS || sinceStop < 7) {
    return {
      ...shown,
      verdict: "watching",
      summary: `You stopped ${name} ${sinceStop === 0 ? "today" : sinceStop === 1 ? "yesterday" : `${sinceStop} days ago`}. NeuroCal is watching whether your ${label} holds for four weeks.`,
    };
  }
  if (before.length < MIN_DAYS || during.length < MIN_DAYS) {
    return { ...shown, verdict: "need_baseline", summary: `There aren't enough numbers from before or while you took ${name} to tell what stopping did.` };
  }
  const b = mean(before);
  const d = mean(during);
  const a = mean(after);
  const threshold = Math.max(MIN_CHANGE[measure], 0.5 * sd(before));
  const helped = d - b >= threshold;
  const held = a - b >= threshold;
  const r = Math.round;
  const numbers = `${r(b)} before, ${r(d)} while you took it, ${r(a)} since you stopped`;
  if (helped && held) {
    return { ...shown, change: Math.round((a - b) * 10) / 10, verdict: "lasted", summary: `Your ${label} stayed up after you stopped ${name}: ${numbers}. You may not need to keep taking it.` };
  }
  if (helped) {
    return { ...shown, change: Math.round((a - d) * 10) / 10, verdict: "faded", summary: `Your ${label} went back down after you stopped ${name}: ${numbers}. It seems to work while you take it.` };
  }
  return {
    ...shown,
    change: Math.round((a - b) * 10) / 10,
    verdict: "no_change",
    summary: held
      ? `Your ${label} rose after you stopped ${name} (${numbers}), so something else is likely behind it.`
      : `No clear change from ${name}, on it or off it: ${numbers}.`,
  };
}
