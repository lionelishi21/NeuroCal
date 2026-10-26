import { describe, expect, it } from "@jest/globals";
import { BOOKS, bookLinks, shelfFor } from "./learn";

describe("shelfFor", () => {
  it("puts each topic's best book first, in the order the topics matter", () => {
    const shelf = shelfFor(["sleep", "fasting"], 4);
    expect(shelf.map((p) => [p.book.id, p.because])).toEqual([
      ["why-we-sleep", "sleep"],
      ["fast-this-way", "fasting"],
      // Then the remaining topics in their standing order.
      ["circadian-code", "timing"],
      ["bulletproof-diet", "food"],
    ]);
  });

  it("never repeats a book, and fills up from every topic", () => {
    const shelf = shelfFor([], BOOKS.length);
    expect(new Set(shelf.map((p) => p.book.id)).size).toBe(BOOKS.length);
  });
});

describe("bookLinks", () => {
  it("searches the stores, with the affiliate tag only when there is one", () => {
    expect(bookLinks({ title: "Head Strong", author: "Dave Asprey" })).toEqual({
      bookUrl: "https://www.amazon.com/s?k=Head%20Strong%20Dave%20Asprey&i=stripbooks",
      audioUrl: "https://www.audible.com/search?keywords=Head%20Strong%20Dave%20Asprey",
    });
    expect(bookLinks({ title: "Breath", author: "James Nestor" }, "neurocal-20").bookUrl).toMatch(/&tag=neurocal-20$/);
  });
});
