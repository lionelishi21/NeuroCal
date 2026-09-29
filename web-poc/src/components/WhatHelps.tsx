"use client";

import { useProtocols } from "../api/queries";

/** Labels contain "and" themselves, so name the count and separate with a comma. */
const intro = (labels: string[]) =>
  labels.length === 1
    ? `This week, ${labels[0]} held your Focus Score back most.`
    : `This week, two things held your Focus Score back most: ${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}.`;

/**
 * Protocols and products matched to the week's weakest Focus Score inputs.
 * Protocols are NeuroCal-authored habits; products are secondary and every
 * affiliate or own-brand link is labelled next to the link itself (ARCHITECTURE §10).
 */
export function WhatHelps() {
  const protocols = useProtocols();

  return (
    <section id="help" aria-labelledby="help-title" className="mt-12 scroll-mt-8">
      <h2 id="help-title" className="mt-0 mb-2 text-xl">
        What could help
      </h2>
      {protocols.isPending && <p className="m-0 text-ink-soft">Finding what fits your week…</p>}
      {protocols.isError && <p className="m-0 text-beet">Suggestions didn't load. Try again shortly.</p>}
      {protocols.data && (
        <>
          <p className="mt-0 mb-5 max-w-[var(--measure)] text-ink-soft">
            {protocols.data.weakPoints.length
              ? intro(protocols.data.weakPoints.map((w) => w.label))
              : "Your week looks steady. These help keep it that way."}
          </p>

          <div className="flex flex-col">
            {protocols.data.protocols.map((p) => (
              <article key={p.id} className="border-t border-rule py-5">
                <h3 className="m-0 text-lg font-semibold">{p.title}</h3>
                <p className="mt-1 mb-0 max-w-[var(--measure)] text-ink-soft">{p.summary}</p>
                <ol className="mt-3 mb-0 max-w-[var(--measure)] list-decimal pl-7 marker:text-ink-soft">
                  {p.steps.map((step) => (
                    <li key={step} className="py-0.5 pl-1">
                      {step}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          {protocols.data.products.length > 0 && (
            <div className="mt-6 border-t border-rule pt-5">
              <h3 className="m-0 text-base font-semibold">Tools that can help</h3>
              <ul className="mt-3 mb-0 list-none p-0">
                {protocols.data.products.map((product) => (
                  <li key={product.id} className="py-2.5">
                    <p className="m-0 text-ink">{product.name}</p>
                    <p className="mt-0.5 mb-0 max-w-[var(--measure)] text-sm text-ink-soft">{product.description}</p>
                    {product.url && (
                      <p className="mt-1 mb-0 flex flex-wrap items-baseline gap-x-3 text-sm">
                        <a
                          href={product.url}
                          target="_blank"
                          rel={product.affiliate || product.ownBrand ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                          className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                        >
                          View {product.name.toLowerCase()}
                        </a>
                        {product.affiliate && <Tag>Affiliate link</Tag>}
                        {product.ownBrand && <Tag>Our brand</Tag>}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {protocols.data.products.some((p) => p.affiliate) && (
                <p className="mt-3 mb-0 max-w-[var(--measure)] text-sm text-ink-soft">
                  NeuroCal may earn a commission from links marked as affiliate. It doesn't change what we suggest: tools are matched to your week the same way as the habits above.
                </p>
              )}
              {protocols.data.products.some((p) => p.supplement) && (
                <p className="mt-3 mb-0 max-w-[var(--measure)] text-sm text-ink-soft">
                  Supplements aren't a substitute for the habits above. Check with your doctor or pharmacist first if you take medication, are pregnant or have a health condition.
                </p>
              )}
              {protocols.data.products.some((p) => p.ownBrand) && (
                <p className="mt-3 mb-0 max-w-[var(--measure)] text-sm text-ink-soft">
                  Items marked "Our brand" are sold by MitoProof, which is run by the people who make NeuroCal. They are matched to your week the same way as everything else here.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-pill px-2 py-0.5 text-xs text-ink-soft ring-1 ring-rule ring-inset">{children}</span>;
}
