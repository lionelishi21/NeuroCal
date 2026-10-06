"use client";

import type { AdminProduct } from "@neurocal/contracts";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { RequestFailed } from "../api/client";
import { useAdminProducts, useCreateAdminProduct, useDeleteAdminProduct, useUpdateAdminProduct } from "../api/queries";
import { useOptionalAuth } from "../auth/AuthProvider";
import { Button } from "../components/Button";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { Screen, ScreenHeader, Section, cardClass } from "../components/Screen";
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

/** This screen's fields sit on cards, so they take the page colour: 48px tall, 14px radius. */
const field =
  "block h-12 w-full rounded-option border-[1.5px] bg-mist px-3.5 text-md text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";
const fieldLabel = "text-xs font-bold";
const fieldError = "text-2xs font-semibold text-beet";
const isLink = (value: string) => /^https:\/\/\S+\.\S+/.test(value);

/**
 * Product management for admins: swap a product's link, label it as an
 * affiliate link, switch it on or off, and add products that aren't in the
 * built-in catalog. Changes are saved on the server and survive deploys.
 */
export function Admin() {
  const products = useAdminProducts();
  const auth = useOptionalAuth();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const forbidden = products.error instanceof RequestFailed && products.error.status === 403;
  const all = products.data?.products ?? [];
  const term = search.trim().toLowerCase();
  const shown = all.filter((p) => matches[filter](p) && (!term || `${p.name} ${p.tags.join(" ")} ${p.description}`.toLowerCase().includes(term)));
  const email = auth?.user?.email;

  return (
    <Screen>
      <ScreenHeader title="Manage products" detail="Admin only" back={{ href: "/settings", label: "Back to Settings" }} />

      {products.isPending && <ScreenLoading label="Loading products" heights={[18.75, 2.75, 13.75]} />}
      {forbidden && (
        <div role="alert" className="m-4 flex flex-col items-start gap-2 rounded-hero border border-rule bg-paper px-5 py-6">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-synapse-soft text-synapse-ink">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <p className="m-0 mt-1 text-xl font-extrabold">This page is for admins</p>
          <p className="m-0 text-md text-pretty text-ink-soft">
            {email ? `You're signed in as ${email}, which doesn't have admin access.` : "This account doesn't have admin access."} Ask an admin to add you.
          </p>
          <Link href="/" className="mt-2 inline-flex h-12 items-center rounded-pill bg-synapse px-[1.375rem] text-md font-bold text-on-accent no-underline hover:brightness-110">
            Back to Today
          </Link>
        </div>
      )}
      {products.isError && !forbidden && (
        <ScreenFailed title="Couldn't load products" onRetry={() => products.refetch()}>
          Check your connection and try again.
        </ScreenFailed>
      )}

      {products.data && (
        <>
          <AddProduct
            onAdded={() => {
              setFilter("All");
              setSearch("");
            }}
          />

          <Section title="Products" kind="title" className="[&>h2]:pt-6">
            <div role="group" aria-label="Show" className="flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
              {FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={filter === option}
                  onClick={() => setFilter(option)}
                  className={`flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border-[1.5px] px-3.5 text-xs font-bold ${
                    filter === option ? "border-synapse bg-synapse text-on-accent" : "border-rule bg-paper text-ink hover:border-rule-strong"
                  }`}
                >
                  {option} <span className="tabular-nums opacity-75">{all.filter(matches[option]).length}</span>
                </button>
              ))}
            </div>
            <div className="relative mx-4 mt-2.5">
              <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-[0.9375rem] left-3.5 size-[1.125rem] text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4 4" />
              </svg>
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${field} border-rule bg-paper pl-[2.625rem]`}
              />
            </div>

            {shown.length === 0 ? (
              <div className="mx-4 mt-3 flex flex-col items-start gap-2.5 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem]">
                <p className="m-0 text-md font-bold">{term ? `No products match "${search.trim()}"` : "No products here yet"}</p>
                <Button
                  variant="soft"
                  className="h-10 px-3.5 text-xs"
                  onClick={() => {
                    setSearch("");
                    setFilter("All");
                  }}
                >
                  Show all products
                </Button>
              </div>
            ) : (
              <ul aria-label="Products" className="m-0 flex list-none flex-col gap-2.5 px-4 pt-3 pb-0">
                {shown.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}

/** A checkbox drawn as the design's rounded box; the real input stays for keyboards and screen readers. */
function Check({ checked, onChange, disabled = false, children }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="grid size-[1.375rem] shrink-0 place-items-center rounded-[0.4375rem] border-2 border-rule-strong text-xs font-extrabold text-transparent peer-checked:border-synapse peer-checked:bg-synapse peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-synapse"
      >
        ✓
      </span>
      <span className="text-sm font-semibold">{children}</span>
    </label>
  );
}

function ProductCard({ product }: { product: AdminProduct }) {
  const update = useUpdateAdminProduct();
  const remove = useDeleteAdminProduct();
  const toast = useToast();
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
    <li aria-label={product.name} className={`flex flex-col gap-2.5 rounded-card border border-rule bg-paper p-4 ${product.enabled ? "" : "opacity-70"}`}>
      <p className="m-0 flex flex-wrap gap-1.5">
        {product.ownBrand ? (
          <Tag className="bg-synapse-soft text-synapse-ink">Our brand</Tag>
        ) : product.affiliate ? (
          <Tag className="bg-glucose-soft text-glucose-ink">Affiliate link</Tag>
        ) : (
          <Tag className="bg-mist text-ink-soft">Other brand</Tag>
        )}
        {product.supplement && <Tag className="bg-mist text-ink-soft">Supplement</Tag>}
        {product.managedBy === "admin" && <Tag className="bg-mist text-ink-soft">Added by you</Tag>}
        {!product.enabled && <Tag className="bg-track text-ink-soft">Turned off</Tag>}
      </p>
      <h3 className="m-0 text-base font-extrabold">{product.name}</h3>
      <p className="m-0 text-xs leading-[1.4] text-ink-soft">{product.description}</p>
      {product.tags.length > 0 && (
        <p className="m-0 text-2xs text-ink-soft">
          Suggested for: <b className="font-semibold text-ink">{product.tags.join(", ")}</b>
        </p>
      )}

      <form onSubmit={saveLink} className="flex gap-1.5">
        <input
          type="url"
          inputMode="url"
          aria-label="Link"
          placeholder="https://"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={`${field} h-11 min-w-0 flex-1 rounded-[0.75rem] border-rule px-3 text-xs`}
        />
        <button
          type="submit"
          disabled={!changed || !link.trim() || update.isPending}
          className="h-11 shrink-0 cursor-pointer rounded-[0.75rem] bg-synapse-soft px-3.5 text-xs font-bold whitespace-nowrap text-synapse-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Save link
        </button>
      </form>
      {product.catalogUrl && (
        <Button variant="text" className="min-h-8 self-start px-0 text-xs" disabled={update.isPending} onClick={() => save({ id: product.id, url: null }, "Built-in link restored")}>
          Use the built-in link
        </Button>
      )}

      <div className="flex flex-col border-t border-rule pt-1">
        <Check
          checked={product.enabled}
          disabled={update.isPending}
          onChange={(on) => save({ id: product.id, enabled: on }, on ? "Product turned on" : "Product turned off")}
        >
          Suggest this product
        </Check>
        {!product.ownBrand && (
          <Check
            checked={product.affiliate}
            disabled={update.isPending}
            onChange={(on) => save({ id: product.id, affiliate: on }, on ? "Labelled as an affiliate link" : "Affiliate label removed")}
          >
            I earn a commission
          </Check>
        )}
      </div>
      {product.managedBy === "admin" && (
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate(product.id, { onSuccess: () => toast("Product removed", "info") })}
          className="h-10 cursor-pointer self-start rounded-pill bg-beet-soft px-3.5 text-xs font-bold text-beet hover:brightness-95 disabled:opacity-45"
        >
          {remove.isPending ? "Removing…" : "Remove product"}
        </button>
      )}

      {(update.isError || remove.isError) && (
        <p role="alert" className={`m-0 ${fieldError}`}>
          {problem(update.error ?? remove.error, "That change didn't save. Try again.")}
        </p>
      )}
    </li>
  );
}

function Tag({ children, className }: { children: string; className: string }) {
  return <span className={`flex h-[1.375rem] items-center rounded-[0.375rem] px-2 text-3xs font-bold ${className}`}>{children}</span>;
}

const OWNERS = [
  ["own", "Our brand"],
  ["affiliate", "Affiliate"],
  ["other", "Other brand"],
] as const;
type Owner = (typeof OWNERS)[number][0];

const emptyDraft = { name: "", description: "", url: "", tags: "", owner: "own" as Owner, supplement: true };
type Errors = Partial<Record<"name" | "description" | "url", string>>;

/** Adds a product that isn't in the built-in catalog, such as a new MitoProof item. */
function AddProduct({ onAdded }: { onAdded: () => void }) {
  const create = useCreateAdminProduct();
  const toast = useToast();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Errors>({});
  const set = (patch: Partial<typeof emptyDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !(key in patch))));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = draft.url.trim();
    const found: Errors = {};
    if (!draft.name.trim()) found.name = "Give the product a name.";
    if (!draft.description.trim()) found.description = "Say what it is in one line.";
    // A link you earn from, or to your own shop, has to be there; another brand's product can go without.
    if (url ? !isLink(url) : draft.owner !== "other") found.url = "Add a full link, starting with https://";
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate(
      {
        name: draft.name.trim(),
        description: draft.description.trim(),
        ...(url ? { url } : {}),
        ownBrand: draft.owner === "own",
        affiliate: draft.owner === "affiliate",
        supplement: draft.supplement,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast("Product added");
          setDraft(emptyDraft);
          create.reset();
          onAdded();
        },
      },
    );
  };

  const border = (key: keyof Errors) => (errors[key] ? "border-beet" : "border-rule");
  return (
    <Section title="Add a product" kind="title" className="[&>h2]:pt-[1.125rem]">
      <form onSubmit={submit} noValidate aria-label="Add a product" className={`${cardClass} flex flex-col gap-3 p-4`}>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Name</span>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="e.g. Magnesium glycinate" aria-invalid={Boolean(errors.name)} className={`${field} ${border("name")}`} />
          {errors.name && <span className={fieldError}>{errors.name}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Description</span>
          <textarea
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            maxLength={600}
            placeholder="One line people will see"
            aria-invalid={Boolean(errors.description)}
            className={`${field} h-auto resize-y py-3 ${border("description")}`}
          />
          {errors.description && <span className={fieldError}>{errors.description}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Link</span>
          <input type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => set({ url: e.target.value })} aria-invalid={Boolean(errors.url)} className={`${field} ${border("url")}`} />
          {errors.url && <span className={fieldError}>{errors.url}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Words to suggest it for</span>
          <input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="sleep, stress, late dinner" className={`${field} border-rule`} />
          <span className="text-2xs text-ink-soft">Separate with commas.</span>
        </label>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className={`mb-1.5 p-0 ${fieldLabel}`}>Whose product is it?</legend>
          <div className="grid grid-cols-3 gap-1 rounded-option bg-mist p-1">
            {OWNERS.map(([value, text]) => (
              <label key={value} className="relative">
                <input type="radio" name="owner" className="peer sr-only" checked={draft.owner === value} onChange={() => set({ owner: value })} />
                <span className="grid h-10 cursor-pointer place-items-center rounded-[0.625rem] text-xs font-bold text-ink-soft peer-checked:bg-paper peer-checked:text-synapse-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                  {text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Check checked={draft.supplement} onChange={(supplement) => set({ supplement })}>
          It's a supplement<span className="font-normal text-ink-soft"> (adds a doctor note)</span>
        </Check>

        {create.isError && (
          <p role="alert" className={`m-0 ${fieldError}`}>
            {problem(create.error, "The product wasn't added. Try again.")}
          </p>
        )}
        <Button type="submit" className="h-[3.125rem] text-md" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add product"}
        </Button>
      </form>
    </Section>
  );
}
