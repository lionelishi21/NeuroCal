import { InvalidError } from "../../domain/errors";
import type { WaitlistPlatform } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IEmailSender } from "../interfaces/IEmailSender";
import type { IWaitlistRepository } from "../interfaces/IRepositories";

export interface WaitlistConfig {
  /** The website, e.g. "https://neurocal.ai"; unsubscribe links point at it. */
  webUrl: string;
  /** A new unguessable token for an unsubscribe link. */
  newToken: () => string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds someone to the list of people to email when the mobile app is ready, and sends one
 * "you're on the list" email. Joining twice is harmless and is not answered differently, so the
 * list can't be probed for who is on it. A failed or switched-off email never fails the request:
 * the address is kept, and the email can go out later (the entry records that it hasn't).
 */
export class JoinWaitlistUseCase {
  constructor(
    private readonly waitlist: IWaitlistRepository,
    private readonly email: IEmailSender,
    private readonly clock: IClock,
    private readonly config: WaitlistConfig,
  ) {}

  async execute(input: { email: string; platform?: WaitlistPlatform }): Promise<void> {
    const address = input.email.trim().toLowerCase();
    if (!EMAIL.test(address) || address.length > 254) throw new InvalidError("Enter a valid email address.");

    const { entry, fresh } = await this.waitlist.join(address, input.platform, this.config.newToken());
    if (!this.email.enabled || (!fresh && entry.confirmationSentAt)) return;

    const unsubscribeUrl = `${this.config.webUrl.replace(/\/+$/, "")}/unsubscribe?token=${encodeURIComponent(entry.unsubscribeToken)}`;
    try {
      await this.email.send({
        to: entry.email,
        subject: "You're on the NeuroCal list",
        text: [
          "Thanks for signing up.",
          "",
          "NeuroCal is coming to iPhone and Android. We'll email you once, the day it's ready to download, with the link.",
          "",
          `Changed your mind, or didn't sign up? Unsubscribe here: ${unsubscribeUrl}`,
          "",
          "NeuroCal",
        ].join("\n"),
        unsubscribeUrl,
      });
      await this.waitlist.markConfirmationSent(entry.id, this.clock.now());
    } catch (error) {
      // Never the address: logs are not where personal data goes.
      console.error(JSON.stringify({ event: "waitlist_email_failed", entry: entry.id, error: String(error) }));
    }
  }
}

/** The unsubscribe link in a waitlist email. An unknown token is answered like a known one. */
export class LeaveWaitlistUseCase {
  constructor(private readonly waitlist: IWaitlistRepository) {}

  async execute(input: { token: string }): Promise<void> {
    await this.waitlist.leave(input.token);
  }
}
