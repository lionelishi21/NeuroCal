import { photoPrefixFor } from "../../domain/photo";
import { accountDeletedEmail } from "../email/templates";
import type { IClock } from "../interfaces/IClock";
import type { IEmailSender } from "../interfaces/IEmailSender";
import type { IIdentityProvider } from "../interfaces/IIdentityProvider";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import type { IUserRepository } from "../interfaces/IRepositories";

/**
 * Deletes an account for good (App Store and Google Play require this in the app). Photos go first
 * and the sign-in last: if a later step fails, the person can still sign in and try again, and
 * signing in again only ever finds an empty account. Once it's gone, a last email confirms it (and
 * warns anyone who didn't do it); that email failing never undoes the deletion.
 */
export class DeleteAccountUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly storage: IObjectStorage,
    private readonly identity: IIdentityProvider,
    private readonly confirm?: { email: IEmailSender; clock: IClock },
  ) {}

  async execute(userId: string): Promise<void> {
    const address = this.confirm?.email.enabled ? await this.users.emailOf(userId) : null;
    await this.storage.deleteAll(photoPrefixFor(userId));
    const deleted = await this.users.delete(userId);
    if (!deleted) return;
    await this.identity.deleteLogin(deleted.authSubject);
    if (!this.confirm || !address || address.endsWith("@unknown")) return;
    const when = this.confirm.clock.now().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
    try {
      await this.confirm.email.send({ to: address, ...accountDeletedEmail({ to: address, when }) });
    } catch (error) {
      // Never the address: logs are not where personal data goes.
      console.error(JSON.stringify({ event: "account_deleted_email_failed", error: String(error) }));
    }
  }
}
