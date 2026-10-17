import { describe, expect, it, jest } from "@jest/globals";
import { TavilyWebSearch } from "./TavilyWebSearch";

describe("TavilyWebSearch", () => {
  it("returns https results without fragments, and throws on an error status", async () => {
    const fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            { title: "Ceramic air fryer", url: "https://maker.example/fryer#reviews", content: "A new model." },
            { title: "Old page", url: "http://insecure.example/x", content: null },
          ],
        }),
      ),
    );
    const search = new TavilyWebSearch({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await search.search("air fryer", { limit: 5 })).toEqual([{ title: "Ceramic air fryer", url: "https://maker.example/fryer", snippet: "A new model." }]);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ query: "air fryer", max_results: 5 });

    const failing = new TavilyWebSearch({ apiKey: "k", fetch: (async () => new Response("", { status: 429 })) as unknown as typeof globalThis.fetch });
    await expect(failing.search("x", { limit: 5 })).rejects.toThrow("429");
  });
});
