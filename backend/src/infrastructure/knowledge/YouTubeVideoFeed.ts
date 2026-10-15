import type { IVideoFeed } from "../../application/interfaces/IKnowledge";

/**
 * New uploads on a YouTube channel, from the YouTube Data API v3 (https://developers.google.com/youtube/v3).
 * Titles, links and dates only: the API gives captions only to a channel's own owner, so transcripts are
 * pasted by an admin. Reads the channel's uploads playlist (1 quota unit a call, not search's 100).
 */
export class YouTubeVideoFeed implements IVideoFeed {
  constructor(private readonly options: { apiKey: string; fetch?: typeof fetch }) {}

  async latest(channelId: string) {
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error(`Not a YouTube channel id: ${channelId}`);
    const uploads = `UU${channelId.slice(2)}`;
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.search = new URLSearchParams({ part: "snippet", playlistId: uploads, maxResults: "15", key: this.options.apiKey }).toString();
    const res = await (this.options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`YouTube uploads lookup failed: ${res.status}`);
    const body = (await res.json()) as {
      items?: { snippet?: { title?: string; publishedAt?: string; channelTitle?: string; resourceId?: { videoId?: string } } }[];
    };
    return (body.items ?? []).flatMap(({ snippet: s }) => {
      const id = s?.resourceId?.videoId;
      // Removed and private videos come back with these titles and nothing to review.
      if (!id || !s?.title || s.title === "Private video" || s.title === "Deleted video") return [];
      return [{ url: `https://www.youtube.com/watch?v=${id}`, title: s.title, channel: s.channelTitle ?? "", publishedAt: new Date(s.publishedAt ?? Date.now()) }];
    });
  }
}
