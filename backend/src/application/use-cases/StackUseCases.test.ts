import { describe, expect, it } from "@jest/globals";
import { InMemoryProfiles, InMemoryStack, profile } from "../testing/fakes";
import { StackUseCases } from "./StackUseCases";

describe("StackUseCases", () => {
  it("links our brand's supplements to their store page, for a reorder", async () => {
    const profiles = new InMemoryProfiles();
    const p = profile();
    await profiles.save(p);
    const stack = new StackUseCases(profiles, new InMemoryStack(), { now: () => new Date("2026-11-02T15:00:00Z") }, undefined, async () => [
      { name: "MitoProof Sleep Formula", url: "https://www.mitoproof.com/products/sleep-formula" },
    ]);
    const item = { ingredients: [], servingsPerDay: 1, timing: "evening" as const };
    await stack.add(p.userId, { ...item, name: "MitoProof Sleep Formula" });
    await stack.add(p.userId, { ...item, name: "Thorne Sleep Formula" });

    const { items } = await stack.get(p.userId);
    expect(items.map((i) => [i.name, i.shopUrl])).toEqual([
      ["MitoProof Sleep Formula", "https://www.mitoproof.com/products/sleep-formula"],
      ["Thorne Sleep Formula", undefined],
    ]);
  });
});
