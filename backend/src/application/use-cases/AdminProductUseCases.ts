import { randomUUID } from "node:crypto";
import { ForbiddenError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { productText, recordHash } from "../../domain/recommendations";
import type { AdminProduct, Product, ProductSettings } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";

/** Who is asking. `isAdmin` comes from the verified sign-in, never from the request body. */
export interface AdminCaller {
  isAdmin: boolean;
}

function requireAdmin(caller: AdminCaller) {
  if (!caller.isAdmin) throw new ForbiddenError("Only an admin can manage products.");
}

/** Links shown to users must be plain https web links. */
function assertHttps(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidError("Enter the link as a full web address, starting with https://.");
  }
  if (parsed.protocol !== "https:") throw new InvalidError("The link must start with https://.");
}

export type NewAdminProduct = Omit<Product, "id">;

/**
 * Product management for the admin screen: change a product's link, affiliate
 * label or whether it is suggested at all, and add or remove products that
 * aren't in the repo's catalog. Settings live in the database and survive
 * catalog syncs and deploys.
 */
export class AdminProductUseCases {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
  ) {}

  async list(caller: AdminCaller): Promise<AdminProduct[]> {
    requireAdmin(caller);
    return this.catalog.listProducts();
  }

  async update(caller: AdminCaller, id: string, settings: ProductSettings): Promise<AdminProduct> {
    requireAdmin(caller);
    if (typeof settings.url === "string") assertHttps(settings.url);
    const updated = await this.catalog.updateProductSettings(id, settings);
    if (!updated) throw new NotFoundError("That product no longer exists.");
    return updated;
  }

  async create(caller: AdminCaller, input: NewAdminProduct): Promise<AdminProduct> {
    requireAdmin(caller);
    const name = input.name.trim();
    const description = input.description.trim();
    if (!name || !description) throw new InvalidError("A product needs a name and a description.");
    if (input.url !== undefined) assertHttps(input.url);
    if ((input.affiliate || input.ownBrand) && !input.url) throw new InvalidError("An affiliate or own-brand product needs a link.");

    const tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    const { url, ...rest } = input;
    const product: Product = { ...rest, ...(url ? { url } : {}), id: `admin-${randomUUID()}`, name, description, tags };

    let embedding: number[] | undefined;
    try {
      [embedding] = await this.embedder.embed([productText(product)]);
    } catch {
      throw new UpstreamError("The product couldn't be prepared for matching right now. Try again in a moment.");
    }
    if (!embedding) throw new UpstreamError("The product couldn't be prepared for matching right now. Try again in a moment.");
    return this.catalog.addProduct({ item: product, embedding, contentHash: recordHash(product) });
  }

  async remove(caller: AdminCaller, id: string): Promise<void> {
    requireAdmin(caller);
    if (!(await this.catalog.removeAdminProduct(id))) {
      throw new NotFoundError("Only products added from this screen can be removed. Turn a catalog product off instead.");
    }
  }
}
