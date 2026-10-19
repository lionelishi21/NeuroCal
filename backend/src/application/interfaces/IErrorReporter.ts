/**
 * Unexpected errors (the 500s and failed scheduled runs), sent to a crash-report service. Domain
 * errors (not found, invalid, daily limit) are answers, not crashes, and are never reported.
 */
export interface ErrorContext {
  /** "api" for requests, or the scheduled job's name. */
  source: string;
  method?: string;
  /** The path with ids replaced, so one bug groups as one issue. */
  route?: string;
}

export interface IErrorReporter {
  /** Never throws and never takes more than a couple of seconds. */
  report(error: unknown, context: ErrorContext): Promise<void>;
}
