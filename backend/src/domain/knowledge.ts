/**
 * The knowledge pipeline (docs/NCBM.md §7): techniques taken from long-form expert content (Dave
 * Asprey's channel and The Human Upgrade first), reviewed by a person, and only then added to the
 * catalog as routines. Nothing reaches users without approval, and every routine keeps its source.
 */
import type { Protocol } from "./types";

/** The seven pillars of the model (docs/NCBM.md §3). */
export const PILLARS = ["fuel", "rhythm", "recovery", "mind", "movement", "environment", "supplements"] as const;
export type Pillar = (typeof PILLARS)[number];

/** Each pillar's matching words, the same vocabulary as the built-in routines, so weak points find them. */
export const PILLAR_TAGS: Record<Pillar, string[]> = {
  fuel: ["high-glycemic meals", "glycemic load", "steady energy", "blood sugar", "meals"],
  rhythm: ["late eating", "timing", "evening routine", "circadian rhythm", "fasting"],
  recovery: ["sleep", "short sleep", "light sleep", "bedtime routine"],
  mind: ["stress", "wired", "low focus", "brain fog", "calm"],
  movement: ["movement", "too little movement", "exercise", "circulation", "energy"],
  environment: ["environment", "light", "air", "water", "noise"],
  supplements: ["supplements", "energy", "focus"],
};

export type TechniqueStatus = "pending" | "approved" | "rejected";

export interface Technique {
  id: string;
  sourceId: string;
  title: string;
  pillar: Pillar;
  summary: string;
  steps: string[];
  /** What the speaker cites, in their words: a study, a mechanism, their experience. */
  evidence: string;
  /** Who should be careful, if the speaker or common sense says so; empty when none. */
  cautions: string;
  /** A short line from the transcript, so a reviewer can find it. */
  quote: string;
  /** Where in the video, when the transcript had timestamps. */
  timestampSeconds?: number;
  status: TechniqueStatus;
  /** The routine it became, once approved. */
  protocolId?: string;
}

export type SourceStatus = "queued" | "extracted" | "failed";

/** A video or episode: found by the channel sync (queued, no transcript yet) or added by an admin. */
export interface KnowledgeSource {
  id: string;
  url: string;
  title: string;
  channel?: string;
  publishedAt?: Date;
  status: SourceStatus;
  addedAt: Date;
}

/** Long enough to be a talk, short enough for one model call (about 2½ hours of speech). */
export const MIN_TRANSCRIPT_CHARS = 500;
export const MAX_TRANSCRIPT_CHARS = 150_000;

/** The YouTube video id from any of its link shapes; null for other links. */
export function youTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const id =
    host === "youtu.be"
      ? u.pathname.slice(1)
      : host === "youtube.com"
        ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1] ?? null)
        : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** The link to the moment in the video, for YouTube links with a timestamp. */
export function linkAt(url: string, seconds?: number): string {
  const id = youTubeId(url);
  if (!id) return url;
  return seconds === undefined ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/watch?v=${id}&t=${Math.floor(seconds)}s`;
}

/** An approved technique as a catalog routine, tagged by pillar and linked to where it was said. */
export function protocolFromTechnique(t: Pick<Technique, "id" | "title" | "summary" | "steps" | "pillar" | "timestampSeconds">, source: Pick<KnowledgeSource, "url" | "title">): Protocol {
  return {
    id: `knowledge-${t.id}`,
    title: t.title.trim(),
    summary: t.summary.trim(),
    steps: t.steps.map((s) => s.trim()).filter(Boolean),
    tags: PILLAR_TAGS[t.pillar],
    source: { title: source.title, url: linkAt(source.url, t.timestampSeconds) },
  };
}
