import { describe, expect, it, jest } from "@jest/globals";
import { OpenFoodFactsDatabase, splitIngredients } from "./OpenFoodFacts";

const reply = (status: number, body: unknown) => jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("Open Food Facts", () => {
  it("splits ingredients on top-level commas only", () => {
    expect(splitIngredients("Oats, milk chocolate (sugar, cocoa butter), _soy_ lecithin.")).toEqual(["Oats", "milk chocolate (sugar, cocoa butter)", "soy lecithin"]);
  });

  it("reads a product per serving, with sodium in milligrams and the NOVA group", async () => {
    const fetch = reply(200, {
      status: 1,
      product: {
        code: "0123456789012",
        product_name: "Honey Granola",
        brands: "Crunchy Co, Parent Co",
        brand_owner: "Crunchy Foods Inc.",
        serving_size: "55 g",
        nutriments: { "energy-kcal_serving": 260, proteins_serving: 5, carbohydrates_serving: 38, fat_serving: 10, sodium_serving: 0.14, "energy-kcal_100g": 473 },
        ingredients_text: "Oats, sugar, soy lecithin",
        nova_group: 4,
      },
    });
    const db = new OpenFoodFactsDatabase({ fetch });
    expect(await db.lookup("0123456789012")).toEqual({
      brand: "Crunchy Co",
      manufacturer: "Crunchy Foods Inc.",
      productName: "Honey Granola",
      barcode: "0123456789012",
      servingSize: "55 g",
      nutrition: { calories: 260, proteinG: 5, carbsG: 38, fatG: 10, sodiumMg: 140 },
      ingredients: ["Oats", "sugar", "soy lecithin"],
      source: "open_food_facts",
      sourceNovaGroup: 4,
    });
    const [, init] = (fetch as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["user-agent"]).toMatch(/^NeuroCal\//);
  });

  it("falls back to per 100 g, and returns null for unknown barcodes", async () => {
    const per100 = new OpenFoodFactsDatabase({ fetch: reply(200, { status: 1, product: { nutriments: { "energy-kcal_100g": 580, proteins_100g: 25, carbohydrates_100g: 16, fat_100g: 49 } } }) });
    expect(await per100.lookup("12345678")).toMatchObject({ servingSize: "100 g", nutrition: { calories: 580 }, ingredients: [] });
    expect(await new OpenFoodFactsDatabase({ fetch: reply(404, {}) }).lookup("12345678")).toBeNull();
    expect(await new OpenFoodFactsDatabase({ fetch: reply(200, { status: 0 }) }).lookup("12345678")).toBeNull();
    await expect(new OpenFoodFactsDatabase({ fetch: reply(503, {}) }).lookup("12345678")).rejects.toThrow();
  });
});
