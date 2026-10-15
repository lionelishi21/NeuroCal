"use client";

import type { KnowledgeSource, KnowledgeTechnique } from "@neurocal/contracts";
import { type FormEvent, useState } from "react";
import { RequestFailed } from "../api/client";
import { useAddKnowledgeSource, useAddTranscript, useAdminKnowledge, useReviewTechnique, useSyncKnowledge } from "../api/queries";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/Button";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { Section, cardClass } from "../components/Screen";
import { useToast } from "../components/Toast";

const problem = (error: unknown, fallback: string) => (error instanceof RequestFailed ? error.message : fallback);

/** Fields on cards take the page colour, as on the Products screen. */
const field =
  "block w-full rounded-option border-[1.5px] border-rule bg-mist px-3.5 text-md text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";
const fieldLabel = "text-xs font-bold";
const fieldError = "text-2xs font-semibold text-beet";
const MIN_TRANSCRIPT = 500;

/** Each pillar in the colour of its body system (docs/NCBM.md §3). */
const PILLAR: Record<KnowledgeTechnique["pillar"], [string, string]> = {
  fuel: ["Fuel", "bg-glucose-soft text-glucose-ink"],
  rhythm: ["Rhythm", "bg-ion-soft text-ion-ink"],
  recovery: ["Recovery", "bg-synapse-soft text-synapse-ink"],
  mind: ["Mind", "bg-beet-soft text-beet"],
  movement: ["Movement", "bg-chlorophyll-soft text-chlorophyll"],
  environment: ["Environment", "bg-track text-ink-soft"],
  supplements: ["Supplements", "bg-mist text-ink"],
};

const STATUS: Record<KnowledgeSource["status"], string> = {
  queued: "Waiting for a transcript",
  extracted: "Read",
  failed: "Couldn't be read",
};

/**
 * The knowledge pipeline for admins (docs/NCBM.md §7): videos come in from the monthly channel check or
 * by hand, techniques are taken from a pasted transcript, and only the ones approved here become routines
 * people see, each linked to where it was said.
 */
export function AdminKnowledge() {
  const knowledge = useAdminKnowledge();
  const sync = useSyncKnowledge();
  const toast = useToast();
  const forbidden = knowledge.error instanceof RequestFailed && knowledge.error.status === 403;
  const sources = knowledge.data?.sources ?? [];
  const pending = sources.flatMap((s) => s.techniques.filter((t) => t.status === "pending").map((t) => ({ technique: t, source: s })));

  return (
    <AdminShell title="Knowledge" detail="Techniques from talks and podcasts. Nothing reaches the app until you approve it.">
      <div className="-mx-4 max-w-[48rem] sm:-mx-5">
        {knowledge.isPending && <ScreenLoading label="Loading knowledge" heights={[16, 12, 12]} />}
        {forbidden && (
          <p role="alert" className="m-4 rounded-hero border border-rule bg-paper px-5 py-6 text-md">
            This page is for admins. Ask an admin to add you.
          </p>
        )}
        {knowledge.isError && !forbidden && (
          <ScreenFailed title="Couldn't load knowledge" onRetry={() => knowledge.refetch()}>
            Check your connection and try again.
          </ScreenFailed>
        )}

        {knowledge.data && (
          <>
            <Section title={`Waiting for review${pending.length ? ` (${pending.length})` : ""}`} kind="title" className="[&>h2]:pt-[1.125rem]">
              {pending.length === 0 ? (
                <p className="mx-4 mt-0 mb-0 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem] text-md text-ink-soft">
                  Nothing to review. Add a video with its transcript below, and its techniques will appear here.
                </p>
              ) : (
                <ul aria-label="Techniques to review" className="m-0 flex list-none flex-col gap-3 px-4 p-0">
                  {pending.map(({ technique, source }) => (
                    <TechniqueCard key={technique.id} technique={technique} source={source} />
                  ))}
                </ul>
              )}
            </Section>

            <AddVideo />

            <Section title="Videos" kind="title" className="[&>h2]:pt-6">
              <div className="mx-4 mb-3 flex flex-wrap items-center gap-3">
                {knowledge.data.watching.length ? (
                  <>
                    <Button
                      variant="soft"
                      className="h-10 px-3.5 text-xs"
                      disabled={sync.isPending}
                      onClick={() =>
                        sync.mutate(undefined, {
                          onSuccess: ({ added }) => toast(added ? `${added} new ${added === 1 ? "video" : "videos"} added` : "No new videos"),
                        })
                      }
                    >
                      {sync.isPending ? "Checking…" : "Check for new videos"}
                    </Button>
                    <span className="text-xs text-ink-soft">Dave Asprey's channel is checked on the 1st of each month.</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-soft">Add YOUTUBE_API_KEY to the app secret to check Dave Asprey's channel for new videos each month.</span>
                )}
                {sync.isError && <span className={fieldError}>{problem(sync.error, "Couldn't check for new videos.")}</span>}
              </div>
              <ul aria-label="Videos" className="m-0 flex list-none flex-col gap-2.5 px-4 p-0">
                {sources.map((source) => (
                  <VideoRow key={source.id} source={source} />
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function TechniqueCard({ technique, source }: { technique: KnowledgeTechnique; source: KnowledgeSource }) {
  const review = useReviewTechnique();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(technique.title);
  const [summary, setSummary] = useState(technique.summary);
  const [name, tone] = PILLAR[technique.pillar];

  const approve = () =>
    review.mutate(
      { id: technique.id, review: { decision: "approve", ...(editing ? { title, summary } : {}) } },
      { onSuccess: () => toast("Added to the routines") },
    );
  const reject = () => review.mutate({ id: technique.id, review: { decision: "reject" } }, { onSuccess: () => toast("Rejected") });

  return (
    <li className={`${cardClass} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {editing ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={fieldLabel}>Title</span>
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={`${field} h-11`} />
          </label>
        ) : (
          <h3 className="m-0 min-w-0 flex-1 text-lg leading-snug font-extrabold">{technique.title}</h3>
        )}
        <span className={`shrink-0 rounded-pill px-2.5 py-1 text-2xs font-bold ${tone}`}>{name}</span>
      </div>
      {editing ? (
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>What it is</span>
          <textarea value={summary} maxLength={500} rows={3} onChange={(e) => setSummary(e.target.value)} className={`${field} resize-y py-3`} />
        </label>
      ) : (
        <p className="m-0 text-md leading-normal text-pretty text-ink-soft">{technique.summary}</p>
      )}
      <ol className="m-0 flex flex-col gap-1 pl-5 text-sm leading-normal">
        {technique.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <dl className="m-0 grid gap-x-3 gap-y-1.5 rounded-control bg-mist p-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="font-bold">Evidence given</dt>
        <dd className="m-0 text-ink-soft">{technique.evidence}</dd>
        <dt className="font-bold">Where it's said</dt>
        <dd className="m-0 text-ink-soft">
          "{technique.quote}"{" "}
          <a href={technique.link} target="_blank" rel="noopener noreferrer" className="font-bold">
            Watch in {source.title}
          </a>
        </dd>
      </dl>
      {technique.cautions && (
        <p className="m-0 rounded-control bg-beet-soft px-3 py-2.5 text-sm text-beet">
          <strong>Caution: </strong>
          {technique.cautions}
        </p>
      )}
      {review.isError && (
        <p role="alert" className={`m-0 ${fieldError}`}>
          {problem(review.error, "That didn't save. Try again.")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 px-5 text-sm" disabled={review.isPending} onClick={approve}>
          {review.isPending ? "Saving…" : editing ? "Approve with edits" : "Approve"}
        </Button>
        <Button variant="soft" className="h-11 px-4 text-sm" disabled={review.isPending} onClick={() => setEditing(!editing)}>
          {editing ? "Cancel edits" : "Edit"}
        </Button>
        <Button variant="quiet" className="h-11 px-4 text-sm" disabled={review.isPending} onClick={reject}>
          Reject
        </Button>
      </div>
    </li>
  );
}

function VideoRow({ source }: { source: KnowledgeSource }) {
  const add = useAddTranscript();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const counts = (status: KnowledgeTechnique["status"]) => source.techniques.filter((t) => t.status === status).length;
  const tooShort = transcript.trim().length < MIN_TRANSCRIPT;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tooShort) return;
    add.mutate(
      { id: source.id, transcript: transcript.trim() },
      {
        onSuccess: (s) => {
          toast(`${s.techniques.filter((t) => t.status === "pending").length} techniques to review`);
          setTranscript("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <li className={`${cardClass} flex flex-col gap-2 p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-md font-bold text-ink">
          {source.title}
        </a>
        <span className={`text-xs font-bold ${source.status === "failed" ? "text-beet" : "text-ink-soft"}`}>{STATUS[source.status]}</span>
      </div>
      {source.techniques.length > 0 && (
        <p className="m-0 text-xs text-ink-soft">
          {counts("approved")} approved, {counts("pending")} to review, {counts("rejected")} rejected
        </p>
      )}
      {source.status !== "extracted" && !open && (
        <Button variant="soft" className="h-10 self-start px-3.5 text-xs" onClick={() => setOpen(true)}>
          {source.status === "failed" ? "Try the transcript again" : "Add the transcript"}
        </Button>
      )}
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-2" aria-label={`Transcript for ${source.title}`}>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            placeholder="On YouTube: … → Show transcript, then select all and paste here. Timestamps help link each technique to its moment."
            aria-label="Transcript"
            className={`${field} resize-y py-3`}
          />
          {add.isError && <span className={fieldError}>{problem(add.error, "The transcript couldn't be read. Try again.")}</span>}
          <div className="flex gap-2">
            <Button type="submit" className="h-10 px-4 text-xs" disabled={add.isPending || tooShort}>
              {add.isPending ? "Reading… (up to half a minute)" : "Find techniques"}
            </Button>
            <Button variant="quiet" className="h-10 px-3.5 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function AddVideo() {
  const add = useAddKnowledgeSource();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = transcript.trim();
    if (!/^https:\/\/\S+\.\S+/.test(url.trim())) return setError("Add the video's full link, starting with https://");
    if (!title.trim()) return setError("Give the video a title.");
    if (text && text.length < MIN_TRANSCRIPT) return setError("That transcript is too short. Paste the whole thing, or leave it empty for now.");
    setError(null);
    add.mutate(
      { url: url.trim(), title: title.trim(), ...(text ? { transcript: text } : {}) },
      {
        onSuccess: (s) => {
          toast(text ? `${s.techniques.length} techniques to review` : "Video added");
          setUrl("");
          setTitle("");
          setTranscript("");
        },
      },
    );
  };

  return (
    <Section title="Add a video or episode" kind="title" className="[&>h2]:pt-6">
      <form onSubmit={submit} noValidate aria-label="Add a video or episode" className={`${cardClass} mx-4 flex flex-col gap-3 p-4`}>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Link</span>
          <input type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} className={`${field} h-12`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Title</span>
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={`${field} h-12`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Transcript (optional)</span>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={5} placeholder="Paste it now, or add it later from the list." className={`${field} resize-y py-3`} />
          <span className="text-2xs text-ink-soft">The transcript is read once to find techniques and isn't kept.</span>
        </label>
        {(error || add.isError) && (
          <p role="alert" className={`m-0 ${fieldError}`}>
            {error ?? problem(add.error, "The video wasn't added. Try again.")}
          </p>
        )}
        <Button type="submit" className="h-[3.125rem] text-md" disabled={add.isPending}>
          {add.isPending ? "Reading the transcript…" : "Add video"}
        </Button>
      </form>
    </Section>
  );
}
