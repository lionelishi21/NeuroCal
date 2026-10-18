import { describe, expect, it } from "@jest/globals";
import { AI_ALLOWANCE } from "../../domain/aiAllowance";
import { FixedClock, InMemoryAiUsage } from "../testing/fakes";
import { AiAllowanceUseCase } from "./AiAllowanceUseCase";

describe("AiAllowanceUseCase", () => {
  it("allows the day's allowance, refuses the next call, and starts again the next day", async () => {
    const clock = new FixedClock(new Date("2026-10-17T10:00:00Z"));
    const allowance = new AiAllowanceUseCase(new InMemoryAiUsage(), clock);
    const sam = { userId: "u1" };
    for (let i = 0; i < AI_ALLOWANCE.generate; i++) await allowance.spend(sam, "generate");
    await expect(allowance.spend(sam, "generate")).rejects.toMatchObject({ code: "daily_limit" });
    // Reads have their own allowance; other people and admins aren't affected.
    await expect(allowance.spend(sam, "read")).resolves.toBeUndefined();
    await expect(allowance.spend({ userId: "u2" }, "generate")).resolves.toBeUndefined();
    await expect(allowance.spend({ userId: "u1", isAdmin: true }, "generate")).resolves.toBeUndefined();
    clock.current = new Date("2026-10-18T00:01:00Z");
    await expect(allowance.spend(sam, "generate")).resolves.toBeUndefined();
  });
});
