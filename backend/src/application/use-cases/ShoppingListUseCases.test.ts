import { describe, expect, it } from "@jest/globals";
import { InMemoryPantry, InMemoryShoppingList } from "../testing/fakes";
import { ShoppingListUseCases } from "./ShoppingListUseCases";

const clock = { now: () => new Date("2026-10-26T10:00:00Z") };

describe("ShoppingListUseCases", () => {
  it("keeps the same item on one line, unticking it and filling in an amount", async () => {
    const list = new ShoppingListUseCases(new InMemoryShoppingList(), new InMemoryPantry(), clock);
    let v = await list.add("u1", [{ name: "Eggs" }, { name: "  spinach " }, { name: "" }]);
    expect(v.items.map((i) => [i.name, i.aisle])).toEqual([
      ["spinach", "produce"],
      ["Eggs", "dairy_eggs"],
    ]);
    const eggs = v.items.find((i) => i.name === "Eggs")!;
    await list.update("u1", eggs.id, { checked: true });
    v = await list.add("u1", [{ name: "egg", quantity: "12" }, { name: "Spinach" }], "plan");
    expect(v.items).toHaveLength(2);
    expect(v.items.find((i) => i.name === "Eggs")).toMatchObject({ checked: false, quantity: "12" });
  });

  it("moves what's bought into the pantry when shopping's done", async () => {
    const pantry = new InMemoryPantry();
    const list = new ShoppingListUseCases(new InMemoryShoppingList(), pantry, clock);
    const v = await list.add("u1", [{ name: "Oats" }, { name: "Salmon" }]);
    await list.update("u1", v.items.find((i) => i.name === "Oats")!.id, { checked: true });
    const done = await list.finish("u1");
    expect(done).toMatchObject({ movedToPantry: 1, items: [{ name: "Salmon" }] });
    expect((await pantry.list("u1")).map((p) => p.name)).toEqual(["Oats"]);
  });

  it("refuses an item that isn't there, and an over-long name", async () => {
    const list = new ShoppingListUseCases(new InMemoryShoppingList(), new InMemoryPantry(), clock);
    await expect(list.update("u1", "nope", { checked: true })).rejects.toThrow("isn't on your list");
    await expect(list.add("u1", [{ name: "x".repeat(81) }])).rejects.toThrow("under 80 characters");
  });
});
