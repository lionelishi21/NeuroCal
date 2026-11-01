import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import { FcmPushSender, parseServiceAccount } from "./FcmPushSender";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = { project_id: "neurocal-test", client_email: "push@neurocal-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

function fakeFetch(answers: { status: number; body?: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const isToken = url.startsWith("https://oauth2.googleapis.com/");
    const a = isToken ? { status: 200, body: { access_token: "access-1", expires_in: 3600 } } : answers.shift()!;
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("FcmPushSender", () => {
  it("signs in with the service account, sends the message, and reuses the sign-in", async () => {
    const f = fakeFetch([{ status: 200 }, { status: 200 }]);
    const sender = new FcmPushSender({ account, fetch: f.fetch, now: () => Date.parse("2026-11-02T15:00:00Z") });
    expect(await sender.send("token-1", { title: "Your Focus Score today: 72", body: "A strong day.", open: "week" })).toBe("sent");
    expect(await sender.send("token-2", { title: "Hi", body: "There" })).toBe("sent");

    const signIns = f.calls.filter((c) => c.url.startsWith("https://oauth2"));
    expect(signIns).toHaveLength(1);
    const assertion = new URLSearchParams(String(signIns[0]!.init.body)).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature!, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toMatchObject({ iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging" });

    const send = f.calls.find((c) => c.url.includes("/messages:send"))!;
    expect(send.url).toBe("https://fcm.googleapis.com/v1/projects/neurocal-test/messages:send");
    expect((send.init.headers as Record<string, string>).authorization).toBe("Bearer access-1");
    expect(JSON.parse(String(send.init.body))).toEqual({
      message: {
        token: "token-1",
        notification: { title: "Your Focus Score today: 72", body: "A strong day." },
        data: { open: "week" },
        android: { priority: "high", notification: { channel_id: "neurocal_news" } },
        apns: { payload: { aps: { sound: "default" } } },
      },
    });
  });

  it("says gone for a token Firebase no longer knows, and fails on anything else", async () => {
    const f = fakeFetch([{ status: 404 }, { status: 400, body: { error: { details: [{ errorCode: "UNREGISTERED" }] } } }, { status: 500 }]);
    const sender = new FcmPushSender({ account, fetch: f.fetch });
    expect(await sender.send("old", { title: "a", body: "b" })).toBe("gone");
    expect(await sender.send("old", { title: "a", body: "b" })).toBe("gone");
    await expect(sender.send("t", { title: "a", body: "b" })).rejects.toThrow("Firebase Cloud Messaging answered 500");
  });

  it("reads the key file's JSON, and nothing else", () => {
    expect(parseServiceAccount(JSON.stringify({ ...account, type: "service_account" }))).toEqual(account);
    expect(parseServiceAccount("set-me")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ project_id: "x" }))).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });
});
