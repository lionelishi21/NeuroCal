import { describe, expect, it, jest } from "@jest/globals";
import { waitForDatabase } from "./migrateLambda";

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
