import { DEVICE_CATEGORIES, type DeviceCandidate, deviceKey, linkFromResults } from "../../domain/devices";
import { ForbiddenError, InvalidError, NotFoundError } from "../../domain/errors";
import type { IDeviceCandidateRepository, IDeviceExtractor, IWebSearch } from "../interfaces/IDevices";
import type { AdminCaller, AdminProductUseCases } from "./AdminProductUseCases";

function requireAdmin(caller: AdminCaller) {
  if (!caller.isAdmin) throw new ForbiddenError("Only an admin can review devices.");
}

/** Search results read per category; up to this many devices are kept from them. */
const RESULTS_PER_CATEGORY = 8;
const DEVICES_PER_CATEGORY = 3;

export type DeviceReview = { decision: "approve"; name?: string; description?: string; url?: string } | { decision: "dismiss" };

/**
 * The monthly device scout for the admin Devices screen: each kitchen category is searched, the
 * results are turned into specific devices, and new ones wait for review. An approved device becomes
 * a product tagged for its category, which the shopping review can then suggest.
 */
export class DeviceScoutUseCases {
  constructor(
    private readonly candidates: IDeviceCandidateRepository,
    private readonly search: IWebSearch | null,
    private readonly extractor: IDeviceExtractor,
    private readonly products: AdminProductUseCases,
  ) {}

  /** Whether the monthly scan can run (it needs a search key). */
  canScan(): boolean {
    return this.search !== null;
  }

  async list(caller: AdminCaller) {
    requireAdmin(caller);
    return this.candidates.list();
  }

  /** New devices go into the list as "pending". A category that fails is skipped, not the whole scan. */
  async scan(): Promise<{ added: number }> {
    if (!this.search) return { added: 0 };
    const known = new Set((await this.candidates.list()).map((c) => deviceKey(c.name)));
    for (const p of await this.products.list({ isAdmin: true })) known.add(deviceKey(p.name));
    let added = 0;
    for (const category of DEVICE_CATEGORIES) {
      try {
        const results = await this.search.search(category.query, { limit: RESULTS_PER_CATEGORY });
        if (results.length === 0) continue;
        const found = await this.extractor.extract({ category: category.label, results });
        const urls = results.map((r) => r.url);
        const fresh = [];
        for (const d of found) {
          const url = linkFromResults(d.url, urls);
          const key = deviceKey(d.name);
          if (!url || !key || known.has(key)) continue;
          known.add(key);
          fresh.push({ ...d, url, tag: category.tag });
          if (fresh.length === DEVICES_PER_CATEGORY) break;
        }
        added += (await this.candidates.add(fresh)).length;
      } catch (error) {
        console.error(JSON.stringify({ event: "device_scan_failed", category: category.tag, error: String(error).slice(0, 300) }));
      }
    }
    return { added };
  }

  async scanAsAdmin(caller: AdminCaller) {
    requireAdmin(caller);
    if (!this.search) throw new InvalidError("Add TAVILY_API_KEY to the app secret to look for new devices.");
    return this.scan();
  }

  /** Approve (optionally edited) into the products, or dismiss. */
  async review(caller: AdminCaller, id: string, review: DeviceReview): Promise<DeviceCandidate> {
    requireAdmin(caller);
    const device = await this.candidates.get(id);
    if (!device) throw new NotFoundError("That device is no longer in the list.");
    if (device.status === "approved") throw new InvalidError("That device is already a product.");
    if (review.decision === "dismiss") return this.candidates.update(id, { status: "dismissed" });

    const name = review.name?.trim() || device.name;
    const description = review.description?.trim() || device.description;
    const url = review.url?.trim() || device.url;
    const category = DEVICE_CATEGORIES.find((c) => c.tag === device.tag)!;
    const product = await this.products.create(caller, {
      name,
      description,
      url,
      affiliate: false,
      ownBrand: false,
      supplement: false,
      tags: [device.tag, category.label.toLowerCase(), "kitchen"],
    });
    return this.candidates.update(id, { status: "approved", productId: product.id, name, description, url });
  }
}
