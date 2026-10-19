/**
 * Health markers: the measurements behind healthspan, tracked over months. Some come from the phone's
 * health store (resting heart rate, HRV, blood pressure, body fat), the rest are typed in from a watch,
 * a tape measure, a grip meter or a lab report. Each has a general adult reference in plain words; none
 * is a diagnosis, and the clinician sets the person's own targets.
 */
export const MARKER_IDS = [
  "resting_hr",
  "hrv",
  "vo2max",
  "bp_systolic",
  "bp_diastolic",
  "waist_cm",
  "grip_kg",
  "body_fat_pct",
  "hba1c",
  "ldl",
  "hdl",
  "triglycerides",
] as const;
export type MarkerId = (typeof MARKER_IDS)[number];

export interface MarkerDefinition {
  label: string;
  unit: string;
  /** Values outside this are typing mistakes or bad readings, and are refused. */
  min: number;
  max: number;
  /** Which way is healthier, when there is one. */
  better: "lower" | "higher" | null;
  reference: string;
}

export const MARKERS: Record<MarkerId, MarkerDefinition> = {
  resting_hr: { label: "Resting heart rate", unit: "bpm", min: 25, max: 220, better: "lower", reference: "Most adults are between 60 and 100 bpm; fit adults are often lower." },
  hrv: { label: "Heart rate variability", unit: "ms", min: 1, max: 300, better: "higher", reference: "Very individual: compare it with your own trend, not with other people." },
  vo2max: { label: "VO2max", unit: "ml/kg/min", min: 10, max: 95, better: "higher", reference: "Higher fitness goes with a longer life. Your watch's estimate is fine to track." },
  bp_systolic: { label: "Blood pressure, top number", unit: "mmHg", min: 60, max: 260, better: "lower", reference: "Under 120 is the usual healthy range for adults." },
  bp_diastolic: { label: "Blood pressure, bottom number", unit: "mmHg", min: 30, max: 160, better: "lower", reference: "Under 80 is the usual healthy range for adults." },
  waist_cm: { label: "Waist", unit: "cm", min: 40, max: 250, better: "lower", reference: "Under half your height is a common healthy guide." },
  grip_kg: { label: "Grip strength", unit: "kg", min: 5, max: 120, better: "higher", reference: "A stronger grip goes with healthier ageing." },
  body_fat_pct: { label: "Body fat", unit: "%", min: 2, max: 70, better: null, reference: "Healthy ranges differ by sex and age." },
  hba1c: { label: "HbA1c", unit: "%", min: 3, max: 20, better: "lower", reference: "Under 5.7% is the usual range without diabetes; your clinician sets your own target." },
  ldl: { label: "LDL cholesterol", unit: "mg/dL", min: 10, max: 400, better: "lower", reference: "Under 100 mg/dL is a common target; your clinician sets your own." },
  hdl: { label: "HDL cholesterol", unit: "mg/dL", min: 10, max: 150, better: "higher", reference: "40 mg/dL or more is the usual minimum; higher is generally better." },
  triglycerides: { label: "Triglycerides", unit: "mg/dL", min: 20, max: 2000, better: "lower", reference: "Under 150 mg/dL is the usual healthy range." },
};

export type MarkerSource = "manual" | "health_connect" | "apple_health";

export interface MarkerReading {
  id: string;
  marker: MarkerId;
  value: number;
  measuredAt: Date;
  source: MarkerSource;
}

export interface MarkerSummary {
  marker: MarkerId;
  latest: MarkerReading;
  /** Latest minus the reading closest to 90 days earlier; null without one at least 30 days older. */
  change: number | null;
  /** Whether that change went the healthier way; null when there's no change or no better direction. */
  improving: boolean | null;
  /** Up to 12 readings, oldest first, for a sparkline. */
  points: { value: number; measuredAt: Date }[];
}

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Per marker with readings: the latest, the change over about three months, and recent points. */
export function summarize(readings: MarkerReading[]): MarkerSummary[] {
  const out: MarkerSummary[] = [];
  for (const marker of MARKER_IDS) {
    const mine = readings.filter((r) => r.marker === marker).sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
    const latest = mine.at(-1);
    if (!latest) continue;
    const target = latest.measuredAt.getTime() - 90 * DAY_MS;
    const earlier = mine
      .filter((r) => latest.measuredAt.getTime() - r.measuredAt.getTime() >= 30 * DAY_MS)
      .sort((a, b) => Math.abs(a.measuredAt.getTime() - target) - Math.abs(b.measuredAt.getTime() - target))[0];
    const change = earlier ? round1(latest.value - earlier.value) : null;
    const better = MARKERS[marker].better;
    out.push({
      marker,
      latest,
      change,
      improving: change === null || change === 0 || better === null ? null : (change < 0) === (better === "lower"),
      points: mine.slice(-12).map((r) => ({ value: r.value, measuredAt: r.measuredAt })),
    });
  }
  return out;
}
