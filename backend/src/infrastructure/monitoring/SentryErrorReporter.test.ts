import { describe, expect, it } from "@jest/globals";
import { SentryErrorReporter, errorReporterFor, framesOf, noErrorReports, reportingErrors, routeOf, scrub } from "./SentryErrorReporter";

const DSN = "https://abc123@o42.ingest.sentry.io/7001";

describe("SentryErrorReporter", () => {
  it("posts one envelope with the error, its stack and the route, and nothing about the user", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const reporter = new SentryErrorReporter(DSN, { environment: "dev", fetch: fakeFetch });
    await reporter.report(new TypeError("Cannot read 'kg' for sam@example.com"), { source: "api", method: "GET", route: "/weights" });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://o42.ingest.sentry.io/api/7001/envelope/");
    expect((sent[0]!.init.headers as Record<string, string>)["x-sentry-auth"]).toContain("sentry_key=abc123");
    const [header, item, event] = String(sent[0]!.init.body).split("\n").map((l) => JSON.parse(l));
    expect(header.event_id).toBe(event.event_id);
    expect(item).toEqual({ type: "event" });
    expect(event.environment).toBe("dev");
    expect(event.tags).toEqual({ source: "api", method: "GET", route: "/weights" });
    expect(event.exception.values[0].type).toBe("TypeError");
    expect(event.exception.values[0].value).toBe("Cannot read 'kg' for [email]");
    expect(event.exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(JSON.stringify(event)).not.toContain("sam@example.com");
  });

  it("never throws, even when Sentry can't be reached", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(new SentryErrorReporter(DSN, { environment: "dev", fetch: failing }).report(new Error("x"), { source: "api" })).resolves.toBeUndefined();
  });

  it("is off without a DSN or with a malformed one", () => {
    expect(errorReporterFor(undefined, "dev")).toBe(noErrorReports);
    expect(errorReporterFor("not a url", "dev")).toBe(noErrorReports);
    expect(errorReporterFor(DSN, "dev")).toBeInstanceOf(SentryErrorReporter);
  });

  it("scrubs emails and long numbers, groups ids in routes, and orders frames oldest first", () => {
    expect(scrub("duplicate key 4155550123 for a.b+c@mail.co.uk")).toBe("duplicate key [number] for [email]");
    expect(routeOf("/markers/0b8e2f3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c")).toBe("/markers/:id");
    expect(routeOf("/foods/barcode/0123456789012")).toBe("/foods/barcode/:n");
    const frames = framesOf("Error: x\n    at inner (/var/task/index.mjs:10:5)\n    at outer (/var/task/node_modules/pg/x.js:3:1)\n    at node:internal/process:1:1");
    expect(frames.map((f) => f.function ?? f.filename)).toEqual(["node:internal/process", "outer", "inner"]);
    expect(frames.map((f) => f.in_app)).toEqual([false, false, true]);
    expect(frames[2]).toMatchObject({ lineno: 10, colno: 5 });
  });

  it("reportingErrors reports a failed scheduled run and still fails it", async () => {
    const seen: unknown[] = [];
    const run = reportingErrors("device_scout", async () => {
      throw new Error("search down");
    }, () => ({ async report(_e, context) { seen.push(context); } }));
    await expect(run()).rejects.toThrow("search down");
    expect(seen).toEqual([{ source: "device_scout" }]);
  });
});
