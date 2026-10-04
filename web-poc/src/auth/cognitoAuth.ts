import { Amplify } from "aws-amplify";
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { AuthError, type AuthClient, type AuthErrorCode } from "./types";

/** Cognito exception names → what the screens explain. Unknown names fall through to "unknown". */
const CODES: Record<string, [AuthErrorCode, string]> = {
  NotAuthorizedException: ["invalid_credentials", "Email or password is incorrect."],
  UserNotFoundException: ["invalid_credentials", "Email or password is incorrect."],
  UsernameExistsException: ["account_exists", "An account with this email already exists."],
  InvalidPasswordException: ["weak_password", "Use at least 10 characters."],
  CodeMismatchException: ["invalid_code", "That code doesn't match. Check the email and try again."],
  ExpiredCodeException: ["expired_code", "That code has expired. Send a new one."],
  LimitExceededException: ["too_many_attempts", "Too many attempts. Wait a few minutes, then try again."],
  TooManyRequestsException: ["too_many_attempts", "Too many attempts. Wait a few minutes, then try again."],
};

export function toAuthError(error: unknown): AuthError {
  const name = error instanceof Error ? error.name : "";
  const [code, message] = CODES[name] ?? ["unknown", "Something went wrong signing in. Try again."];
  return new AuthError(code, message);
}

const mapped =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw toAuthError(error);
    }
  };

/** Cognito user pool via Amplify Auth (SRP sign-in, matching the infra stack's web client). */
export function createCognitoAuth(config: { userPoolId: string; userPoolClientId: string }): AuthClient {
  Amplify.configure({ Auth: { Cognito: { ...config, loginWith: { email: true } } } });

  return {
    async currentUser() {
      try {
        const user = await getCurrentUser();
        return { email: user.signInDetails?.loginId ?? user.username };
      } catch {
        return null;
      }
    },
    signIn: mapped(async (email: string, password: string) => {
      const result = await signIn({ username: email.trim(), password });
      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") return "confirm" as const;
      if (!result.isSignedIn) throw new AuthError("unknown", "This account needs a sign-in step the app doesn't support yet.");
      return "done" as const;
    }),
    signUp: mapped(async (email: string, password: string) => {
      await signUp({ username: email.trim(), password, options: { userAttributes: { email: email.trim() } } });
    }),
    confirmSignUp: mapped(async (email: string, code: string) => {
      await confirmSignUp({ username: email.trim(), confirmationCode: code.trim() });
    }),
    resendCode: mapped(async (email: string) => {
      await resendSignUpCode({ username: email.trim() });
    }),
    signOut: mapped(() => signOut()),
    async idToken() {
      try {
        const session = await fetchAuthSession();
        return session.tokens?.idToken?.toString() ?? null;
      } catch {
        return null;
      }
    },
  };
}
