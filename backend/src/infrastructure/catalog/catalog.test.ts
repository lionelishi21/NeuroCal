import { describe, expect, it } from "@jest/globals";
import { PRODUCTS, PROTOCOLS } from "./catalog";

describe("catalog", () => {
  it("has unique ids", () => {
    for (const list of [PRODUCTS, PROTOCOLS]) {
      const ids = list.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every affiliate and own-brand product an https link", () => {
    for (const product of PRODUCTS.filter((p) => p.affiliate || p.ownBrand)) {
      expect(product.url).toMatch(/^https:\/\//);
    }
  });

  it("never ships another affiliate's tracking link", () => {
    // Links copied from a partner's recommendations page carry their referral codes.
    for (const product of PRODUCTS) {
      expect(product.url ?? "").not.toMatch(/[?&/](ref|rfsn|sca_ref|aff_id|coupon-code)=|\/dave\b|asprey/i);
    }
  });

  it("marks the partner brands as affiliate and supplements as supplements", () => {
    const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
    for (const id of ["truedark-evening-glasses", "danger-coffee", "bodyhealth-perfectamino"]) {
      expect(byId.get(id)).toMatchObject({ affiliate: true, ownBrand: false });
    }
    expect(byId.get("bodyhealth-perfectamino")?.supplement).toBe(true);
    expect(byId.get("lmnt-electrolytes")?.supplement).toBe(true);
  });
});
