import { describe, expect, it } from "@jest/globals";
import { FakeEmbedder, FakeTechniqueExtractor, FakeVideoFeed, InMemoryCatalog, InMemoryKnowledge } from "../testing/fakes";
import { KnowledgeUseCases } from "./KnowledgeUseCases";

const admin = { isAdmin: true };
const transcript = "0:00 Welcome back.\n1:30 Your calf is your second heart. " + "More talk. ".repeat(60);

function build(feed = new FakeVideoFeed()) {
  const knowledge = new InMemoryKnowledge();
  const catalog = new InMemoryCatalog();
  const extractor = new FakeTechniqueExtractor();
  const useCase = new KnowledgeUseCases(knowledge, extractor, catalog, new FakeEmbedder(), feed, ["UC0123456789012345678901"]);
  return { knowledge, catalog, extractor, useCase };
}

describe("KnowledgeUseCases", () => {
  it("takes techniques from a pasted transcript; nothing reaches the catalog until approved", async () => {
    const { catalog, useCase } = build();
    const { source, techniques } = await useCase.addSource(admin, { url: "https://youtu.be/dQw4w9WgXcQ", title: "Your second heart", transcript });
    expect(source.status).toBe("extracted");
    expect(techniques).toHaveLength(1);
    expect(catalog.protocols.size).toBe(0);

    const approved = await useCase.review(admin, techniques[0]!.id, { decision: "approve", title: "Ten calf raises after meals" });
    expect(approved).toMatchObject({ status: "approved", title: "Ten calf raises after meals", protocolId: "knowledge-t1" });
    const protocol = catalog.protocols.get("knowledge-t1")!.item;
    expect(protocol.source).toEqual({ title: "Your second heart", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s" });
    // A catalog sync keeps it, unlike a routine removed from the repo.
    await catalog.retain({ protocols: [], products: [] });
    expect(catalog.protocols.has("knowledge-t1")).toBe(true);
    await expect(useCase.review(admin, techniques[0]!.id, { decision: "approve" })).rejects.toThrow("already in the catalog");
  });

  it("is for admins only, and refuses a transcript that's too short", async () => {
    const { useCase } = build();
    await expect(useCase.list({ isAdmin: false })).rejects.toThrow("Only an admin");
    await expect(useCase.addSource(admin, { url: "https://youtu.be/dQw4w9WgXcQ", title: "x", transcript: "too short" })).rejects.toThrow("too short");
  });

  it("queues new uploads from watched channels once each", async () => {
    const video = { url: "https://www.youtube.com/watch?v=abcdefghijk", title: "New episode", channel: "Dave Asprey", publishedAt: new Date("2026-10-01") };
    const { knowledge, useCase } = build(new FakeVideoFeed([video]));
    expect(await useCase.sync()).toEqual({ added: 1 });
    expect(await useCase.sync()).toEqual({ added: 0 });
    expect((await knowledge.list())[0]!.source).toMatchObject({ title: "New episode", status: "queued" });
  });
});
