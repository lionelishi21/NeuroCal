import { describe, expect, it } from "@jest/globals";
import { ForbiddenError } from "../../domain/errors";
import type { FunnelWeek } from "../../domain/funnel";
import { AdminFunnelUseCase, FUNNEL_WEEKS } from "./AdminFunnelUseCase";

const clock = { now: () => new Date("2026-11-08T15:00:00Z") }; // a Sunday
const week = (weekStart: string, signedUp: number, onboarded: number, subscribed: number, paid: number): FunnelWeek => ({ weekStart, signedUp, onboarded, subscribed, paid });

describe("AdminFunnelUseCase", () => {
  it("shows the last twelve weeks newest first, with empty weeks as zeros", async () => {
    let asked: Date | undefined;
    const funnel = {
      weeksSince: async (since: Date) => {
        asked = since;
        return [week("2026-11-02", 10, 7, 3, 0), week("2026-10-19", 20, 15, 6, 2)];
      },
    };
    const { weeks, total } = await new AdminFunnelUseCase(funnel, clock).execute({ isAdmin: true });
    expect(asked?.toISOString()).toBe("2026-08-17T00:00:00.000Z");
    expect(weeks).toHaveLength(FUNNEL_WEEKS);
    expect(weeks[0]).toEqual(week("2026-11-02", 10, 7, 3, 0));
    expect(weeks[1]).toEqual(week("2026-10-26", 0, 0, 0, 0));
    expect(weeks[2]!.signedUp).toBe(20);
    expect(weeks.at(-1)!.weekStart).toBe("2026-08-17");
    expect(total).toEqual({ signedUp: 30, onboarded: 22, subscribed: 9, paid: 2 });
  });

  it("is for admins only", async () => {
    const funnel = { weeksSince: async () => [] };
    await expect(new AdminFunnelUseCase(funnel, clock).execute({ isAdmin: false })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
