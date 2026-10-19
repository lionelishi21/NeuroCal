/**
 * Blood sugar from a glucose sensor (CGM), one summary per day: the phone reads the sensor's samples
 * from Health Connect / Apple Health and sends the day's average, time in range and variability. When
 * yesterday has one, the Focus Score's blood-sugar input is measured from it instead of estimated from
 * meals. Ranges follow common CGM practice: 70–140 mg/dL for people without diabetes, 70–180 with it.
 */
export interface GlucoseDay {
  date: string;
  meanMgdl: number;
  /** Share of readings 70–140 mg/dL, 0–100. */
  inRange140Pct: number;
  /** Share of readings 70–180 mg/dL, 0–100. */
  inRange180Pct: number;
  /** Coefficient of variation, 0–100: how much it swung. */
  cvPct: number;
  readings: number;
  source: "health_connect" | "apple_health";
}

/** About 12 hours of a 5-minute sensor: fewer readings (finger-pricks) don't describe a day. */
export const MIN_SENSOR_READINGS = 144;

/** Above this coefficient of variation, swings are large (a common CGM threshold). */
const STABLE_CV = 36;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 0–1: time in range, less a little for large swings. */
export function glucoseComponent(day: Pick<GlucoseDay, "inRange140Pct" | "inRange180Pct" | "cvPct">, diabetic: boolean): number {
  const inRange = (diabetic ? day.inRange180Pct : day.inRange140Pct) / 100;
  return clamp01(inRange - Math.max(0, day.cvPct - STABLE_CV) / 100);
}

/** Summarise a day's samples (mg/dL); null when there aren't enough for a sensor day. */
export function summarizeGlucose(samples: number[]): Omit<GlucoseDay, "date" | "source"> | null {
  if (samples.length < MIN_SENSOR_READINGS) return null;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
  const pct = (lo: number, hi: number) => Math.round((100 * samples.filter((s) => s >= lo && s <= hi).length) / samples.length);
  return {
    meanMgdl: Math.round(mean),
    inRange140Pct: pct(70, 140),
    inRange180Pct: pct(70, 180),
    cvPct: Math.round((100 * sd) / mean),
    readings: samples.length,
  };
}
