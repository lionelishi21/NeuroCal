import { randomUUID } from "node:crypto";
import type { ErrorContext, IErrorReporter } from "../../application/interfaces/IErrorReporter";

/**
 * Crash reports to Sentry (ARCHITECTURE §10), posted straight to its envelope endpoint: no SDK, so
 * nothing patches http or adds to the cold start. Only the error's type, a scrubbed message, the stack
 * and the route are sent: no request body, no user, no email addresses, no health values.
 */
export class SentryErrorReporter implements IErrorReporter {
  private readonly endpoint: string;
  private readonly auth: string;

  constructor(
    private readonly dsn: string,
    private readonly opts: { environment: string; release?: string; fetch?: typeof fetch; timeoutMs?: number },
  ) {
    const url = new URL(dsn);
    const project = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !project) throw new Error("SENTRY_DSN should look like https://<key>@<host>/<project>.");
    const prefix = url.pathname.slice(0, url.pathname.lastIndexOf("/"));
    this.endpoint = `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/`;
    this.auth = `Sentry sentry_version=7, sentry_key=${url.username}, sentry_client=neurocal-backend/1.0`;
  }

  async report(error: unknown, context: ErrorContext): Promise<void> {
    try {
      const eventId = randomUUID().replaceAll("-", "");
      const err = error instanceof Error ? error : new Error(String(error));
      const event = {
        event_id: eventId,
        timestamp: Date.now() / 1000,
        platform: "node",
        level: "error",
        environment: this.opts.environment,
        ...(this.opts.release ? { release: this.opts.release } : {}),
        tags: { source: context.source, ...(context.method ? { method: context.method } : {}), ...(context.route ? { route: context.route } : {}) },
        ...(context.route ? { transaction: `${context.method ?? ""} ${context.route}`.trim() } : {}),
        exception: { values: [{ type: err.name || "Error", value: scrub(err.message), stacktrace: { frames: framesOf(err.stack) } }] },
      };
      const body = [JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: this.dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
      await (this.opts.fetch ?? fetch)(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": this.auth },
        body,
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 2000),
      });
    } catch {
      // A crash report must never cause a second failure.
    }
  }
}

/** Reports nothing; used without a DSN. */
export const noErrorReports: IErrorReporter = { async report() {} };

/** The reporter for SENTRY_DSN, or none. */
export function errorReporterFor(dsn: string | undefined, environment: string): IErrorReporter {
  if (!dsn) return noErrorReports;
  try {
    return new SentryErrorReporter(dsn, { environment });
  } catch (e) {
    console.error(JSON.stringify({ event: "sentry_dsn_invalid", error: String(e) }));
    return noErrorReports;
  }
}

/** Messages can carry what a user typed or a database value: emails and long digit runs go, and it's capped. */
export function scrub(message: string): string {
  return message
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .slice(0, 500);
}

/** V8 stack lines, oldest call first as Sentry expects. */
export function framesOf(stack: string | undefined): { function?: string; filename: string; lineno?: number; colno?: number; in_app: boolean }[] {
  const frames = [];
  for (const line of (stack ?? "").split("\n").slice(1)) {
    const m = /^\s*at (?:(.+?) \()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/.exec(line);
    if (!m) continue;
    const filename = m[2]!;
    frames.push({
      ...(m[1] ? { function: m[1] } : {}),
      filename,
      ...(m[3] ? { lineno: Number(m[3]) } : {}),
      ...(m[4] ? { colno: Number(m[4]) } : {}),
      in_app: !filename.includes("node_modules") && !filename.startsWith("node:"),
    });
  }
  return frames.reverse();
}

/** "/markers/0b8e…-…" → "/markers/:id": UUIDs, numbers and barcodes. */
export function routeOf(path: string): string {
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:n");
}

/** Wraps a scheduled Lambda: a failed run is reported, then fails as before so the retry and alarm still work. */
export function reportingErrors<A extends unknown[], R>(source: string, run: (...args: A) => Promise<R>, reporter: () => IErrorReporter): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await run(...args);
    } catch (e) {
      await reporter().report(e, { source });
      throw e;
    }
  };
}
