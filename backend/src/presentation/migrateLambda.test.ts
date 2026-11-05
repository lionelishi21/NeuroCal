import { describe, expect, it, jest } from "@jest/globals";
import { handler, waitForDatabase } from "./migrateLambda";

describe("waitForDatabase", () => {
  it("retries while a paused database wakes, then goes on", async () => {
    const query = jest.fn<(sql: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT"))
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT"))
      .mockResolvedValue({ rows: [] });
    const log = jest.fn();
    await waitForDatabase({ query }, { pauseMs: 0, log });
    expect(query).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt with the real error", async () => {
    const query = jest.fn<(sql: string) => Promise<unknown>>().mockRejectedValue(new Error("connect ETIMEDOUT"));
    await expect(waitForDatabase({ query }, { attempts: 3, pauseMs: 0, log: () => {} })).rejects.toThrow("connect ETIMEDOUT");
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe("handler", () => {
  it("skips, without failing the deploy, until an external database's URL is in the app secret", async () => {
    const saved = { ...process.env };
    for (const key of ["DATABASE_URL", "DB_SECRET_ARN", "APP_SECRET_ARN"]) delete process.env[key];
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(handler()).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(expect.stringContaining("migrations skipped"));
    } finally {
      log.mockRestore();
      process.env = saved;
    }
  });
});
