import { describe, expect, it } from "@jest/globals";
import { linkAt, protocolFromTechnique, youTubeId } from "./knowledge";

describe("knowledge", () => {
  it("reads YouTube ids from every link shape, and nothing from other links", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(youTubeId(url)).toBe("dQw4w9WgXcQ");
    }
    expect(youTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeId("not a link")).toBeNull();
  });

  it("links to the moment in the video", () => {
    expect(linkAt("https://youtu.be/dQw4w9WgXcQ", 754.6)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=754s");
    expect(linkAt("https://daveasprey.com/episode-1", 30)).toBe("https://daveasprey.com/episode-1");
  });

  it("turns an approved technique into a routine tagged by its pillar, with its source", () => {
    const protocol = protocolFromTechnique(
      { id: "t1", title: " Calf raises after meals ", summary: "Ten slow calf raises.", steps: ["Stand up.", " ", "Rise onto your toes ten times."], pillar: "movement", timestampSeconds: 90 },
      { url: "https://youtu.be/dQw4w9WgXcQ", title: "The calf muscle and your brain" },
    );
    expect(protocol).toEqual({
      id: "knowledge-t1",
      title: "Calf raises after meals",
      summary: "Ten slow calf raises.",
      steps: ["Stand up.", "Rise onto your toes ten times."],
      tags: expect.arrayContaining(["movement", "circulation"]),
      source: { title: "The calf muscle and your brain", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s" },
    });
  });
});
