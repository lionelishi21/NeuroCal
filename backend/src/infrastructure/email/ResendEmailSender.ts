import type { Email, IEmailSender } from "../../application/interfaces/IEmailSender";

type Fetch = typeof fetch;

/**
 * Sends email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * `from` must be on a domain verified with Resend, e.g. "NeuroCal <hello@neurocal.ai>".
 */
export class ResendEmailSender implements IEmailSender {
  readonly enabled = true;

  constructor(private readonly options: { apiKey: string; from: string; fetch?: Fetch }) {}

  async send(email: Email): Promise<void> {
    const response = await (this.options.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: this.options.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${email.unsubscribeUrl}>` } } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    // The body may echo the recipient, so only the status goes into the error.
    if (!response.ok) throw new Error(`Resend answered ${response.status}`);
  }
}

/** Email switched off: used until a Resend key is configured. Nothing is sent and nothing fails. */
export const noEmail: IEmailSender = {
  enabled: false,
  async send() {},
};
