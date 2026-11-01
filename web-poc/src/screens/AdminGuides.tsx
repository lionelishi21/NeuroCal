"use client";

import type { Guide, GuideStatus, GuideSummary } from "@neurocal/contracts";
import { type FormEvent, useEffect, useState } from "react";
import { RequestFailed } from "../api/client";
import { useGuide, useGuides, useSaveGuide } from "../api/queries";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/Button";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { cardClass } from "../components/Screen";
import { useToast } from "../components/Toast";

/** This screen's fields sit on cards, so they take the page colour (as on Products). */
const field =
  "block h-12 w-full rounded-option border-[1.5px] border-rule bg-mist px-3.5 text-md text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";
const fieldLabel = "text-xs font-bold";
const fieldError = "text-2xs font-semibold text-beet";

const STATUS: Record<GuideStatus, string> = { draft: "Draft", published: "Published" };

const problem = (error: unknown, fallback: string) => (error instanceof RequestFailed ? error.message : fallback);

/**
 * Guides in the app (docs/NCBM.md §11): an admin edits the text and publishes it once it has been
 * reviewed. Drafts are seen only by admins, in the app and here.
 */
export function AdminGuides() {
  const guides = useGuides();
  const [selected, setSelected] = useState<string | null>(null);
  const list = guides.data?.guides ?? [];
  const forbidden = guides.error instanceof RequestFailed && guides.error.status === 403;
  const current = selected ?? list[0]?.id ?? null;

  return (
    <AdminShell title="Guides" detail="Long reads in the app. Drafts are only seen by admins: publish a guide once its text has been reviewed.">
      {guides.isPending && <ScreenLoading label="Loading guides" heights={[13.75, 30]} />}
      {forbidden && (
        <p role="alert" className="m-0 rounded-card border border-rule bg-paper p-5 text-md">
          This page is for admins.
        </p>
      )}
      {guides.isError && !forbidden && (
        <ScreenFailed title="Couldn't load the guides" onRetry={() => guides.refetch()}>
          Check your connection and try again.
        </ScreenFailed>
      )}
      {guides.data && (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
          <ul aria-label="Guides" className="m-0 flex list-none flex-col gap-2 p-0">
            {list.map((g) => (
              <GuideRow key={g.id} guide={g} current={g.id === current} onSelect={() => setSelected(g.id)} />
            ))}
          </ul>
          {current && <Editor key={current} id={current} />}
        </div>
      )}
    </AdminShell>
  );
}

function GuideRow({ guide, current, onSelect }: { guide: GuideSummary; current: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? "true" : undefined}
        className={`flex w-full cursor-pointer flex-col items-start gap-1 rounded-card border bg-paper px-4 py-3 text-left ${current ? "border-synapse" : "border-rule hover:border-rule-strong"}`}
      >
        <span className="text-sm font-bold text-ink">{guide.title}</span>
        <span className="flex flex-wrap gap-1.5 text-2xs text-ink-soft">
          <StatusTag status={guide.status} />
          {guide.brand === "ownBrand" && <span className="rounded-pill bg-mist px-2 py-0.5 font-bold">Our brand</span>}
          {guide.program && <span className="rounded-pill bg-mist px-2 py-0.5 font-bold">30-day program</span>}
          <span className="py-0.5">{guide.minutes} min read</span>
        </span>
      </button>
    </li>
  );
}

function StatusTag({ status }: { status: GuideStatus }) {
  const tone = status === "published" ? "bg-chlorophyll-soft text-chlorophyll-ink" : "bg-sun-soft text-sun-ink";
  return <span className={`rounded-pill px-2 py-0.5 font-bold ${tone}`}>{STATUS[status]}</span>;
}

type Draft = Pick<Guide, "title" | "subtitle" | "summary" | "body" | "status">;

function Editor({ id }: { id: string }) {
  const guide = useGuide(id);
  const save = useSaveGuide();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (guide.data && !draft) {
      const { title, subtitle, summary, body, status } = guide.data;
      setDraft({ title, subtitle, summary, body, status });
    }
  }, [guide.data, draft]);

  if (guide.isPending || !draft) return <ScreenLoading label="Loading the guide" heights={[30]} />;
  if (guide.isError) {
    return (
      <ScreenFailed title="Couldn't load this guide" onRetry={() => guide.refetch()}>
        Check your connection and try again.
      </ScreenFailed>
    );
  }

  const saved = guide.data;
  const changed = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== saved[k]);
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMissing(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      setMissing(true);
      return;
    }
    save.mutate({ id, ...draft }, { onSuccess: (g) => toast(g.status === "published" ? "Guide published" : "Guide saved") });
  };

  return (
    <form onSubmit={submit} noValidate aria-label={`Edit ${saved.title}`} className={`${cardClass} m-0 flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Title</span>
          <input value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Subtitle</span>
          <input value={draft.subtitle} maxLength={200} onChange={(e) => set({ subtitle: e.target.value })} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Summary for the list</span>
        <textarea value={draft.summary} maxLength={400} rows={2} onChange={(e) => set({ summary: e.target.value })} className={`${field} h-auto resize-y py-3`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Text</span>
        <span className="text-2xs text-ink-soft">
          ## for a chapter, ### for a section, a line starting &quot;- &quot; for a list, | for a table, **bold** and _italic_.
        </span>
        <textarea value={draft.body} rows={24} onChange={(e) => set({ body: e.target.value })} className={`${field} h-auto resize-y py-3 text-sm leading-[1.5]`} />
      </label>
      <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
        <legend className={`mb-1.5 p-0 ${fieldLabel}`}>Who sees it</legend>
        <div className="grid max-w-[24rem] grid-cols-2 gap-1 rounded-option bg-mist p-1">
          {(["draft", "published"] as const).map((value) => (
            <label key={value} className="relative">
              <input type="radio" name="status" className="peer sr-only" checked={draft.status === value} onChange={() => set({ status: value })} />
              <span className="grid h-10 cursor-pointer place-items-center rounded-[0.625rem] text-xs font-bold text-ink-soft peer-checked:bg-paper peer-checked:text-synapse-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                {value === "draft" ? "Draft: admins only" : "Published: everyone"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {missing && (
        <p role="alert" className={`m-0 ${fieldError}`}>
          A guide needs a title and text.
        </p>
      )}
      {save.isError && (
        <p role="alert" className={`m-0 ${fieldError}`}>
          {problem(save.error, "The guide wasn't saved. Try again.")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-[3.125rem] px-6 text-md" disabled={save.isPending || !changed}>
          {save.isPending ? "Saving…" : "Save guide"}
        </Button>
        <span className="text-2xs text-ink-soft">
          {changed ? "Unsaved changes" : `Saved ${new Date(saved.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
        </span>
      </div>
    </form>
  );
}
