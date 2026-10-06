"use client";

import type { ReactNode } from "react";
import { useProtocols } from "../api/queries";
import { LoadFailed, LoadingLines } from "./ListStates";
import { cardClass } from "./Screen";

const groupTitle = "m-0 px-5 pb-2 text-xs font-bold text-ink-soft";
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Days of data the week needs before its weak points mean anything. */
const DAYS_NEEDED = 3;

/**
 * The week's weakest Focus Score inputs, with the routines and products matched
 * to them. Routines are NeuroCal-authored habits; products come second and every
 * affiliate or own-brand link is labelled on the product itself (ARCHITECTURE §10).
 * With too few days logged it says how many more are needed instead.
 */
export function WhatHelps({ daysLogged }: { daysLogged: number }) {
  const sparse = daysLogged < DAYS_NEEDED;
  const protocols = useProtocols();
  const missing = DAYS_NEEDED - daysLogged;
  const data = protocols.data;

  return (
    <section id="help" aria-labelledby="help-title" className="scroll-mt-4">
      <h2 id="help-title" className="m-0 px-5 pt-[1.625rem] pb-1 text-xl font-extrabold tracking-[-0.015em]">
        What could help
      </h2>

      {sparse && (
        <p className="mx-4 mt-2 mb-0 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem] text-sm text-pretty text-ink-soft">
          Log {missing === 1 ? "one more day" : `${missing} more days`} and we'll show the week's weak points, routines to try and products that might help.
        </p>
      )}
      {!sparse && protocols.isPending && (
        <div className={`${cardClass} mt-2 p-4`}>
          <LoadingLines label="Finding what fits your week" />
        </div>
      )}
      {!sparse && protocols.isError && (
        <div className={`${cardClass} mt-2 p-4`}>
          <LoadFailed title="Suggestions didn't load" onRetry={() => protocols.refetch()}>
            Your week is still here. Try again in a moment.
          </LoadFailed>
        </div>
      )}

      {!sparse && data && (
        <>
          <h3 className={`${groupTitle} pt-1.5`}>Weak points this week</h3>
          {data.weakPoints.length ? (
            <ul className={`${cardClass} m-0 list-none overflow-hidden p-0`}>
              {data.weakPoints.map((point) => (
                <li key={point.component} className="flex gap-3 border-t border-rule px-4 py-3 first:border-t-0">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-glucose" />
                  <div>
                    <p className="m-0 text-md font-bold">{sentenceCase(point.label)}</p>
                    <p className="m-0 mt-0.5 text-xs leading-[1.4] text-ink-soft">Scored {Math.round(point.average * 100)} out of 100 on average over the week.</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${cardClass} m-0 px-4 py-3 text-sm text-ink-soft`}>Your week looks steady. The routines below help keep it that way.</p>
          )}

          {data.protocols.length > 0 && (
            <>
              <h3 className={`${groupTitle} pt-[1.125rem]`}>Routines to try</h3>
              <div className="flex flex-col gap-2.5 px-4">
                {data.protocols.map((p) => (
                  <article key={p.id} className="rounded-card border border-rule bg-paper p-4">
                    <h4 className="m-0 text-base font-extrabold">{p.title}</h4>
                    <p className="m-0 mt-0.5 text-xs text-ink-soft">{p.summary}</p>
                    <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                      {p.steps.map((step, i) => (
                        <li key={step} className="flex items-start gap-2.5">
                          <span aria-hidden className="grid size-[1.375rem] shrink-0 place-items-center rounded-full bg-synapse-soft text-2xs font-extrabold text-synapse-ink">
                            {i + 1}
                          </span>
                          <span className="pt-px text-sm leading-[1.4]">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </>
          )}

          {data.products.length > 0 && (
            <>
              <h3 className={`${groupTitle} pt-[1.125rem]`}>Products that might help</h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 px-4 py-0">
                {data.products.map((product) => (
                  <li key={product.id} className="flex flex-col gap-2 rounded-card border border-rule bg-paper py-3.5 pr-3.5 pl-4">
                    {(product.ownBrand || product.affiliate || product.supplement) && (
                      <p className="m-0 flex flex-wrap gap-1.5">
                        {product.ownBrand && <Tag className="bg-synapse-soft text-synapse-ink">Our brand</Tag>}
                        {product.affiliate && <Tag className="bg-glucose-soft text-glucose-ink">Affiliate link</Tag>}
                        {product.supplement && <Tag className="bg-mist text-ink-soft">Supplement</Tag>}
                      </p>
                    )}
                    <p className="m-0 text-base font-bold">{product.name}</p>
                    <p className="m-0 text-xs leading-[1.4] text-ink-soft">{product.description}</p>
                    {product.supplement && (
                      <p className="m-0 rounded-[0.625rem] bg-mist px-2.5 py-2 text-2xs leading-[1.4]">
                        Supplement. Check with your doctor before starting it, especially if you're pregnant or take medication.
                      </p>
                    )}
                    {product.url && (
                      <a
                        href={product.url}
                        target="_blank"
                        rel={product.affiliate || product.ownBrand ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                        aria-label={`See product: ${product.name}`}
                        className="flex h-10 items-center gap-1.5 self-start rounded-pill border-[1.5px] border-rule-strong px-3.5 text-xs font-bold text-synapse-ink no-underline hover:border-ink-soft"
                      >
                        See product
                        <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {data.products.some((p) => p.affiliate || p.ownBrand) && (
                <p className="mx-5 mt-2.5 mb-0 text-2xs leading-normal text-pretty text-ink-soft">
                  {data.products.some((p) => p.affiliate) && "We earn a commission when you buy through an affiliate link. "}
                  {data.products.some((p) => p.ownBrand) && "\"Our brand\" products are sold by MitoProof, which is run by the people who make NeuroCal. "}
                  Neither changes what we suggest; suggestions come from your week's data.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`flex h-[1.375rem] items-center rounded-[0.375rem] px-2 text-3xs font-bold ${className}`}>{children}</span>;
}
