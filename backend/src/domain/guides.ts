/** A guide: long-form reading in the app (docs/NCBM.md §11). */
export interface GuideRecord {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  /** Markdown subset: ## and ### headings, paragraphs, "- " lists, pipe tables, **bold**, _italic_. */
  body: string;
  /** "ownBrand": MitoProof's, labelled "Our brand". */
  brand: "ownBrand" | "general";
  /** Drafts are seen only by admins. */
  status: "draft" | "published";
  /** Has a day-by-day program (domain/program.ts). */
  program: boolean;
  updatedAt: Date;
}

/** Minutes to read at about 220 words a minute. */
export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}
