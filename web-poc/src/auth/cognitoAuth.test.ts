import { describe, expect, it } from "vitest";
import { toAuthError } from "./cognitoAuth";

const named = (name: string) => Object.assign(new Error("raw provider text"), { name });

describe("toAuthError", () => {
  it("maps Cognito exceptions to messages the screens can show", () => {
    expect(toAuthError(named("NotAuthorizedException"))).toMatchObject({ code: "invalid_credentials", message: "Email or password is incorrect." });
    // preventUserExistenceErrors: an unknown email reads the same as a wrong password.
    expect(toAuthError(named("UserNotFoundException")).code).toBe("invalid_credentials");
    expect(toAuthError(named("UsernameExistsException")).code).toBe("account_exists");
    expect(toAuthError(named("CodeMismatchException")).code).toBe("invalid_code");
    expect(toAuthError(named("ExpiredCodeException")).code).toBe("expired_code");
    expect(toAuthError(named("LimitExceededException")).code).toBe("too_many_attempts");
  });

  it("never shows raw provider text for unknown errors", () => {
    const error = toAuthError(named("SomethingNewException"));
    expect(error.code).toBe("unknown");
    expect(error.message).not.toContain("raw provider text");
  });
});
