/** What the app needs from an identity provider. Cognito in deployed stages, a local mock otherwise. */
export interface AuthClient {
  /** The signed-in user, or null. */
  currentUser(): Promise<AuthUser | null>;
  /** Resolves "confirm" when the account exists but the email isn't verified yet. */
  signIn(email: string, password: string): Promise<"done" | "confirm">;
  signUp(email: string, password: string): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** A current ID token for the API, refreshed when needed; null when signed out. */
  idToken(): Promise<string | null>;
}

export interface AuthUser {
  email: string;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "account_exists"
  | "weak_password"
  | "invalid_code"
  | "expired_code"
  | "too_many_attempts"
  | "unknown";

/** Provider errors mapped to what the screens can explain. */
export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const PASSWORD_MIN_LENGTH = 10;
