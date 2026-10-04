"use client";

import type { AdminProduct } from "@neurocal/contracts";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { RequestFailed } from "../api/client";
import { useAdminProducts, useCreateAdminProduct, useDeleteAdminProduct, useUpdateAdminProduct } from "../api/queries";
import { Button } from "../components/Button";
import { fieldClass } from "../components/fields";
import { useToast } from "../components/Toast";

const FILTERS = ["All", "Our brand", "Affiliate", "Other brands", "Turned off"] as const;
type Filter = (typeof FILTERS)[number];

const matches: Record<Filter, (p: AdminProduct) => boolean> = {
  All: () => true,
  "Our brand": (p) => p.ownBrand,
  Affiliate: (p) => p.affiliate,
  "Other brands": (p) => !p.ownBrand && !p.affiliate,
  "Turned off": (p) => !p.enabled,
};

const problem = (error: unknown, fallback: string) => (error instanceof RequestFailed ? error.message : fallback);
const smallField = fieldClass.replace("text-lg", "text-base");
const check = "size-5 accent-[var(--synapse)]";

/**
 * Product management for admins: swap a product's link, label it as an
 * affiliate link, switch it on or off, and add products that aren't in the
 * built-in catalog. Changes are saved on the server and survive deploys.
 */
export function Admin() {
  const products = useAdminProducts();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const searchId = useId();

  const forbidden = products.error instanceof RequestFailed && products.error.status === 403;
  const all = products.data?.products ?? [];
  const term = search.trim().toLowerCase();
  const shown = all.filter((p) => matches[filter](p) && (!term || `${p.name} ${p.description}`.toLowerCase().includes(term)));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 lg:pt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="m-0 text-2xl">Manage products</h1>
        <Link href="/settings" className="shrink-0 text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
          Back to settings
        </Link>
      </div>
      <p className="mt-2 mb-0 max-w-[var(--measure)] text-ink-soft">
        These are the products NeuroCal can suggest under "What could help". Your own supplements are suggested before any other brand's.
      </p>

      {products.isPending && <p className="mt-8 text-ink-soft">Loading products…</p>}
      {forbidden && (
        <p role="alert" className="mt-8 text-ink">
          This page is for admins. Sign in with an admin account to manage products.
        </p>
      )}
      {products.isError && !forbidden && (
        <div role="alert" className="mt-8">
          <p className="m-0 text-beet">The products didn't load. Check your connection and try again.</p>
          <Button variant="text" className="mt-1 -ml-1" onClick={() => products.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {products.data && (
        <>
          <AddProduct />

          <div className="mt-10 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                  className={`cursor-pointer rounded-pill px-3.5 py-2 text-sm ring-1 ring-inset ${
                    filter === option ? "bg-synapse text-on-accent ring-synapse" : "bg-paper text-ink ring-rule hover:ring-ink-soft"
                  }`}
                >
                  {option} <span className="tabular-nums opacity-70">{all.filter(matches[option]).length}</span>
                </button>
              ))}
            </div>
            <label htmlFor={searchId} className="min-w-[12rem] flex-1 text-sm text-ink-soft">
              Search
              <input id={searchId} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className={smallField} />
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="mt-6 border-t border-rule pt-4 text-ink-soft">No products match. Clear the search or choose another group.</p>
          ) : (
            <ul aria-label="Products" className="m-0 mt-6 list-none p-0">
              {shown.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function ProductRow({ product }: { product: AdminProduct }) {
  const update = useUpdateAdminProduct();
  const remove = useDeleteAdminProduct();
  const toast = useToast();
  const linkId = useId();
  const [link, setLink] = useState(product.url ?? "");
  const changed = link.trim() !== (product.url ?? "");

  const save = (settings: Parameters<typeof update.mutate>[0], done: string) =>
    update.mutate(settings, {
      onSuccess: (saved) => {
        setLink(saved.url ?? "");
        toast(done);
      },
    });

  const saveLink = (e: FormEvent) => {
    e.preventDefault();
    if (changed && link.trim()) save({ id: product.id, url: link.trim() }, "Link saved");
  };

  return (
    <li aria-label={product.name} className={`border-t border-rule py-5 last:border-b ${product.enabled ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-base font-semibold">{product.name}</h2>
        {product.ownBrand && <Tag>Our brand</Tag>}
        {product.affiliate && <Tag>Affiliate link</Tag>}
        {product.supplement && <Tag>Supplement</Tag>}
        {product.managedBy === "admin" && <Tag>Added by you</Tag>}
        {!product.enabled && <Tag>Turned off</Tag>}
      </div>
      <p className="mt-1 mb-0 max-w-[var(--measure)] text-sm text-ink-soft">{product.description}</p>

      <form onSubmit={saveLink} className="mt-3 flex flex-wrap items-end gap-3">
        <label htmlFor={linkId} className="min-w-[14rem] flex-1 text-sm text-ink-soft">
          Link
          <input
            id={linkId}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className={smallField}
          />
        </label>
        <Button type="submit" variant="quiet" disabled={!changed || !link.trim() || update.isPending}>
          Save link
        </Button>
      </form>
      {product.catalogUrl && (
        <p className="mt-2 mb-0 text-sm text-ink-soft">
          Replaces the built-in link, <span className="break-all">{product.catalogUrl}</span>.{" "}
          <Button variant="text" className="text-sm" disabled={update.isPending} onClick={() => save({ id: product.id, url: null }, "Built-in link restored")}>
            Use the built-in link
          </Button>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className={check}
            checked={product.enabled}
            disabled={update.isPending}
            onChange={(e) => save({ id: product.id, enabled: e.target.checked }, e.target.checked ? "Product turned on" : "Product turned off")}
          />
          Suggest this product
        </label>
        {!product.ownBrand && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className={check}
              checked={product.affiliate}
              disabled={update.isPending}
              onChange={(e) => save({ id: product.id, affiliate: e.target.checked }, e.target.checked ? "Labelled as an affiliate link" : "Affiliate label removed")}
            />
            I earn a commission from this link
          </label>
        )}
        {product.managedBy === "admin" && (
          <Button
            variant="text"
            className="text-sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate(product.id, { onSuccess: () => toast("Product removed") })}
          >
            {remove.isPending ? "Removing…" : "Remove product"}
          </Button>
        )}
      </div>

      {(update.isError || remove.isError) && (
        <p role="alert" className="mt-2 mb-0 text-sm text-beet">
          {problem(update.error ?? remove.error, "That change didn't save. Try again.")}
        </p>
      )}
    </li>
  );
}

const Tag = ({ children }: { children: string }) => (
  <span className="rounded-pill px-2.5 py-0.5 text-xs text-ink-soft ring-1 ring-rule ring-inset">{children}</span>
);

const emptyDraft = { name: "", description: "", url: "", tags: "", kind: "own" as "own" | "affiliate" | "other", supplement: true };

/** Adds a product that isn't in the built-in catalog, such as a new MitoProof item. */
function AddProduct() {
  const create = useCreateAdminProduct();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const set = (patch: Partial<typeof emptyDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const ready = draft.name.trim() && draft.description.trim() && (draft.kind === "other" || draft.url.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    create.mutate(
      {
        name: draft.name.trim(),
        description: draft.description.trim(),
        ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
        ownBrand: draft.kind === "own",
        affiliate: draft.kind === "affiliate",
        supplement: draft.supplement,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast("Product added");
          setDraft(emptyDraft);
          setOpen(false);
          create.reset();
        },
      },
    );
  };

  if (!open) {
    return (
      <Button className="mt-6" onClick={() => setOpen(true)}>
        Add a product
      </Button>
    );
  }

  const label = "block text-sm text-ink-soft";
  return (
    <form onSubmit={submit} aria-label="Add a product" className="mt-6 rounded-card bg-paper p-5 ring-1 ring-rule ring-inset">
      <h2 className="m-0 text-lg">Add a product</h2>
      <label className={`mt-4 ${label}`}>
        Name
        <input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={smallField} />
      </label>
      <label className={`mt-3 ${label}`}>
        What it is
        <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={600} className={`${smallField} h-auto py-3`} />
        <span className="mt-1 block">One or two plain sentences. Say what it is; leave out health claims.</span>
      </label>
      <label className={`mt-3 ${label}`}>
        Link
        <input type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => set({ url: e.target.value })} className={smallField} />
      </label>
      <label className={`mt-3 ${label}`}>
        Suggest it for
        <input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="sleep, low focus, protein" className={smallField} />
        <span className="mt-1 block">Words separated by commas. They decide when it is suggested.</span>
      </label>

      <fieldset className="m-0 mt-4 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm text-ink-soft">Whose product is it?</legend>
        <div className="flex flex-col gap-2 text-base">
          {(
            [
              ["own", "Our brand (MitoProof)"],
              ["affiliate", "Another brand, and I earn a commission"],
              ["other", "Another brand, no commission"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="kind" className={check} checked={draft.kind === value} onChange={() => set({ kind: value })} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-base">
        <input type="checkbox" className={check} checked={draft.supplement} onChange={(e) => set({ supplement: e.target.checked })} />
        It is a dietary supplement
      </label>

      {create.isError && (
        <p role="alert" className="mt-4 mb-0 text-sm text-beet">
          {problem(create.error, "The product wasn't added. Try again.")}
        </p>
      )}
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={!ready || create.isPending}>
          {create.isPending ? "Adding…" : "Add product"}
        </Button>
        <Button variant="text" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
