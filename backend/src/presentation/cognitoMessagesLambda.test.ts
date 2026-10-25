import { describe, expect, it } from "@jest/globals";
import { handler } from "./cognitoMessagesLambda";

const event = (triggerSource: string) => ({ triggerSource, request: { codeParameter: "{####}", userAttributes: { email: "maya@example.com" } }, response: {} });

describe("Cognito custom messages", () => {
  it("designs the sign-up and reset codes", async () => {
    const signUp = await handler(event("CustomMessage_SignUp"));
    expect(signUp.response.emailSubject).toBe("Your NeuroCal code");
    expect(signUp.response.emailMessage).toContain("{####}");
    expect((await handler(event("CustomMessage_ForgotPassword"))).response.emailSubject).toBe("Reset your NeuroCal password");
  });

  it("leaves other messages to Cognito", async () => {
    expect((await handler(event("CustomMessage_AdminCreateUser"))).response).toEqual({});
  });
});
