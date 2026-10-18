import { describe, expect, it } from "@jest/globals";
import { costUsd } from "./aiCost";

describe("costUsd", () => {
  it("prices a call from its tokens", () => {
    // A meal photo: about 1,200 tokens in, 400 out on gpt-4o.
    expect(costUsd("gpt-4o", 1200, 400)).toBe(0.007);
    // A meal plan: 3,000 in, 2,500 out on Claude Haiku 4.5.
    expect(costUsd("claude-haiku-4-5", 3000, 2500)).toBe(0.0155);
    expect(costUsd("some-other-model", 1000, 1000)).toBeNull();
  });
});
