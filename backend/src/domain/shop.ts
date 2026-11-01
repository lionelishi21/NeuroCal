/**
 * Our brand's store page for a supplement in someone's stack, so the app can offer a reorder. Only a
 * name that says MitoProof counts: another brand's magnesium never gets a MitoProof link.
 */
export function shopUrlFor(name: string, products: readonly { name: string; url?: string }[]): string | undefined {
  if (!/mito\s*proof/i.test(name)) return undefined;
  const have = core(name);
  // The longest product name inside the stack name: "Sleep Formula" beats "Sleep" if both existed.
  let best: { length: number; url: string } | undefined;
  for (const p of products) {
    const want = core(p.name);
    if (!p.url || want.length < 3 || !have.includes(want)) continue;
    if (!best || want.length > best.length) best = { length: want.length, url: p.url };
  }
  return best?.url;
}

const core = (name: string) =>
  ` ${name.toLowerCase().replace(/mito\s*proof/g, " ").replace(/[^a-z0-9+]+/g, " ")} `.replace(/ the /g, " ").replace(/\s+/g, " ");
