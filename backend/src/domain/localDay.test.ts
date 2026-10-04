import { describe, expect, it } from "@jest/globals";
import { isIsoDate, localDateOf } from "./localDay";

describe("localDateOf", () => {
  it("uses the user's time zone, not UTC", () => {
    const lateEveningInChicago = new Date("2026-09-30T03:30:00Z"); // 22:30 on the 29th in Chicago
    expect(localDateOf(lateEveningInChicago, "America/Chicago")).toBe("2026-09-29");
    expect(localDateOf(lateEveningInChicago, "UTC")).toBe("2026-09-30");
  });
});

describe("isIsoDate", () => {
  it("accepts calendar dates only", () => {
    expect(isIsoDate("2026-09-29")).toBe(true);
    expect(isIsoDate("2026-13-40")).toBe(false);
    expect(isIsoDate("29/09/2026")).toBe(false);
  });
});
