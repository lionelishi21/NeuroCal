import { describe, expect, it, jest } from "@jest/globals";
import { ResendEmailSender } from "./ResendEmailSender";

const email = { to: "sam@example.com", subject: "Hello", text: "Body", unsubscribeUrl: "https://neurocal.ai/unsubscribe?token=abc" };

describe("ResendEmailSender", () => {
  it("posts the email to Resend with the key and an unsubscribe header", async () => {
    const fetch = jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("{}", { status: 200 }));
    await new ResendEmailSender({ apiKey: "re_test", from: "NeuroCal <hello@neurocal.ai>", fetch: fetch as typeof globalThis.fetch }).send(email);

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    expect(JSON.parse(init!.body as string)).toEqual({
      from: "NeuroCal <hello@neurocal.ai>",
      to: ["sam@example.com"],
      subject: "Hello",
      text: "Body",
      headers: { "List-Unsubscribe": "<https://neurocal.ai/unsubscribe?token=abc>" },
    });
  });

  it("fails with the status only, never the address", async () => {
    const fetch = jest.fn(async () => new Response(JSON.stringify({ message: "bad sam@example.com" }), { status: 422 }));
    await expect(new ResendEmailSender({ apiKey: "k", from: "f", fetch: fetch as typeof globalThis.fetch }).send(email)).rejects.toThrow("Resend answered 422");
  });
});
