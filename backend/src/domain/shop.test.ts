import { describe, expect, it } from "@jest/globals";
import { shopUrlFor } from "./shop";

const products = [
  { name: "MitoProof Magnesium Glycinate", url: "https://www.mitoproof.com/products/magnesium-glycinate" },
  { name: "MitoProof Sleep Formula", url: "https://www.mitoproof.com/products/sleep-formula" },
  { name: "MitoProof NAD+", url: "https://www.mitoproof.com/products/nad" },
  { name: "MitoProof NMN" },
];

describe("shopUrlFor", () => {
  it("finds our brand's page from the name as scanned", () => {
    expect(shopUrlFor("MitoProof Magnesium Glycinate 120 caps", products)).toBe("https://www.mitoproof.com/products/magnesium-glycinate");
    expect(shopUrlFor("Mitoproof sleep formula", products)).toBe("https://www.mitoproof.com/products/sleep-formula");
    expect(shopUrlFor("MitoProof NAD+", products)).toBe("https://www.mitoproof.com/products/nad");
  });

  it("never links another brand's product, or one without a page", () => {
    expect(shopUrlFor("Thorne Magnesium Glycinate", products)).toBeUndefined();
    expect(shopUrlFor("MitoProof NMN", products)).toBeUndefined();
    expect(shopUrlFor("MitoProof Something New", products)).toBeUndefined();
  });
});
