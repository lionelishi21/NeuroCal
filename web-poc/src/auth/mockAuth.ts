import { AuthError, PASSWORD_MIN_LENGTH, type AuthClient, type AuthUser } from "./types";

/** The verification code the mock "emails". Shown on the confirm screen in mock mode. */
export const MOCK_CODE = "123456";

interface Stored {
  users: Record<string, { password: string; confirmed: boolean }>;
  session: string | null;
}

/** Storage can throw (private mode, blocked site data); the mock then keeps state in memory only. */
function safeStorage(storage: Storage | null, key: string) {
  let memory: Stored = { users: {}, session: null };
  return {
    read(): Stored {
      try {
        const raw = storage?.getItem(key);
        if (raw) memory = JSON.parse(raw) as Stored;
      } catch {
        // keep memory
      }
      return memory;
    },
    write(value: Stored) {
      memory = value;
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // memory only
      }
    },
  };
}

/**
 * Local stand-in for Cognito so the app runs without AWS: accounts live in this
 * browser, every code is 123456. Mirrors Cognito's rules closely enough to exercise the screens.
 * Pass `null` to keep accounts in memory only (tests).
 */
export function createMockAuth(storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): AuthClient {
  const store = safeStorage(storage, "neurocal.mockAuth");
  const key = (email: string) => email.trim().toLowerCase();

  return {
    async currentUser(): Promise<AuthUser | null> {
      const { session } = store.read();
      return session ? { email: session } : null;
    },
    async signIn(email, password) {
      const s = store.read();
      const user = s.users[key(email)];
      if (!user || user.password !== password) throw new AuthError("invalid_credentials", "Email or password is incorrect.");
      if (!user.confirmed) return "confirm";
      store.write({ ...s, session: key(email) });
      return "done";
    },
    async signUp(email, password) {
      const s = store.read();
      if (s.users[key(email)]) throw new AuthError("account_exists", "An account with this email already exists.");
      if (password.length < PASSWORD_MIN_LENGTH)
        throw new AuthError("weak_password", `Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      store.write({ ...s, users: { ...s.users, [key(email)]: { password, confirmed: false } } });
    },
    async confirmSignUp(email, code) {
      const s = store.read();
      const user = s.users[key(email)];
      if (!user || code.trim() !== MOCK_CODE) throw new AuthError("invalid_code", "That code doesn't match. Check the email and try again.");
      store.write({ ...s, users: { ...s.users, [key(email)]: { ...user, confirmed: true } } });
    },
    async resendCode() {},
    async signOut() {
      store.write({ ...store.read(), session: null });
    },
    async idToken() {
      const { session } = store.read();
      return session ? `mock.${btoa(session)}` : null;
    },
  };
}
