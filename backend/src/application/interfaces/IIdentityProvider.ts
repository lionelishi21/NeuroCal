/** The sign-in service (Cognito in production). */
export interface IIdentityProvider {
  /** Removes the sign-in for this subject. Does nothing if it is already gone. */
  deleteLogin(subject: string): Promise<void>;
}
