/**
 * Kitchen devices the shopping review can suggest (domain/shopping.ts DEVICE_RULES), and the monthly
 * scout that looks for new models of each. Found devices wait for an admin; only approved ones become
 * products, so nothing reaches users because a search result said so.
 */
export const DEVICE_CATEGORIES = [
  {
    tag: "kitchen:air-fryer",
    label: "Air fryer",
    query: "new air fryer models with ceramic or stainless steel baskets (no PTFE non-stick coating)",
  },
  {
    tag: "kitchen:water-filter",
    label: "Water filter",
    query: "new countertop or under-sink water filters independently certified to NSF/ANSI 53, 58 or 401",
  },
  {
    tag: "kitchen:ice-cream-maker",
    label: "Ice cream maker",
    query: "new ice cream makers for homemade ice cream from whole ingredients, like the Ninja Creami",
  },
  {
    tag: "kitchen:blender",
    label: "Blender",
    query: "new high-power blenders for smoothies with a glass or BPA-free jar",
  },
] as const;

export type DeviceTag = (typeof DEVICE_CATEGORIES)[number]["tag"];
export const DEVICE_TAGS = DEVICE_CATEGORIES.map((c) => c.tag) as [DeviceTag, ...DeviceTag[]];

export type DeviceStatus = "pending" | "approved" | "dismissed";

/** A device the scout found, waiting for review. */
export interface DeviceCandidate {
  id: string;
  tag: DeviceTag;
  name: string;
  maker: string;
  /** The maker's or a retailer's product page, from the search results. */
  url: string;
  /** What it is and why it fits, in our words; the maker's claims are worded as theirs. */
  description: string;
  status: DeviceStatus;
  /** The product made from it, once approved. */
  productId?: string;
  foundAt: Date;
}

/** Lower case, letters and digits only: "Ninja CREAMi® NC301" and "ninja creami nc301" are the same device. */
export function deviceKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Only https product pages that appeared in the search results: the model can't invent a link. */
export function linkFromResults(url: string, resultUrls: string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const clean = parsed.toString().split("#")[0]!;
  return resultUrls.some((r) => r.split("#")[0] === clean) ? clean : null;
}
