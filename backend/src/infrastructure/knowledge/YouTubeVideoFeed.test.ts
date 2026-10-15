import { describe, expect, it } from "@jest/globals";
import { YouTubeVideoFeed } from "./YouTubeVideoFeed";

describe("YouTubeVideoFeed", () => {
  it("reads the channel's uploads playlist, skipping private and deleted videos", async () => {
    let asked = "";
    const fetch = (async (url: URL) => {
      asked = url.toString();
      return new Response(
        JSON.stringify({
          items: [
            { snippet: { title: "Your second heart", publishedAt: "2026-10-01T15:00:00Z", channelTitle: "Dave Asprey", resourceId: { videoId: "dQw4w9WgXcQ" } } },
            { snippet: { title: "Private video", resourceId: { videoId: "aaaaaaaaaaa" } } },
          ],
        }),
      );
    }) as unknown as typeof globalThis.fetch;
    const feed = new YouTubeVideoFeed({ apiKey: "k", fetch });
    expect(await feed.latest("UC1KoulyXR8gBGyxv7r6pWQg")).toEqual([
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Your second heart", channel: "Dave Asprey", publishedAt: new Date("2026-10-01T15:00:00Z") },
    ]);
    // The uploads playlist: "UU" + the channel id after "UC".
    expect(asked).toContain("playlistId=UU1KoulyXR8gBGyxv7r6pWQg");
    await expect(feed.latest("not-a-channel")).rejects.toThrow("Not a YouTube channel id");
  });
});
