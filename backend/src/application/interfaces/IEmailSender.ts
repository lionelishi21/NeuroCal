export interface Email {
  to: string;
  subject: string;
  /** Plain text; every email has one. */
  text: string;
  /** Where "unsubscribe" in the mail client goes (the List-Unsubscribe header). */
  unsubscribeUrl?: string;
}

export interface IEmailSender {
  /** False when email is switched off (no provider configured): nothing was sent and nothing failed. */
  readonly enabled: boolean;
  send(email: Email): Promise<void>;
}
