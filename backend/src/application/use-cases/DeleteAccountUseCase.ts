import { photoPrefixFor } from "../../domain/photo";
import type { IIdentityProvider } from "../interfaces/IIdentityProvider";
import type { IObjectStorage } from "../interfaces/IObjectStorage";
import type { IUserRepository } from "../interfaces/IRepositories";

/**
 * Deletes an account for good (App Store and Google Play require this in the app). Photos go first
 * and the sign-in last: if a later step fails, the person can still sign in and try again, and
 * signing in again only ever finds an empty account.
 */
export class DeleteAccountUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly storage: IObjectStorage,
    private readonly identity: IIdentityProvider,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.storage.deleteAll(photoPrefixFor(userId));
    const deleted = await this.users.delete(userId);
    if (deleted) await this.identity.deleteLogin(deleted.authSubject);
  }
}
