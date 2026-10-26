/**
 * The Learn shelf: books (and their audiobooks) for what someone is working on, chosen from their own
 * data: the weakest parts of their Focus Score first, then fasting, supplements and the rest. A short,
 * hand-picked list, each with a sentence on why it fits. Descriptions are ours; the authors' claims are
 * worded as theirs.
 */

export const LEARN_TOPICS = ["sleep", "timing", "food", "stress", "movement", "fasting", "supplements", "focus", "longevity", "habits"] as const;
export type LearnTopic = (typeof LEARN_TOPICS)[number];

export interface Book {
  id: string;
  title: string;
  author: string;
  /** What it covers, the first being what it's best for. */
  topics: LearnTopic[];
  /** What it is, in a sentence. */
  summary: string;
}

export const BOOKS: Book[] = [
  { id: "head-strong", title: "Head Strong", author: "Dave Asprey", topics: ["focus", "food", "supplements"], summary: "How the brain makes energy, and the food, light and supplement changes the author says sharpen it in two weeks." },
  { id: "fast-this-way", title: "Fast This Way", author: "Dave Asprey", topics: ["fasting", "food"], summary: "Fasting without the misery: easing in, what breaks a fast, and longer fasts done safely." },
  { id: "super-human", title: "Super Human", author: "Dave Asprey", topics: ["longevity", "sleep", "supplements"], summary: "The author's case for slowing ageing: sleep, light, food, supplements and the gadgets he uses." },
  { id: "smarter-not-harder", title: "Smarter Not Harder", author: "Dave Asprey", topics: ["habits", "movement", "focus"], summary: "Biohacking as getting more from less effort: short workouts, better sleep and habits that run themselves." },
  { id: "bulletproof-diet", title: "The Bulletproof Diet", author: "Dave Asprey", topics: ["food", "fasting"], summary: "The eating plan behind Bulletproof coffee: fats, timing and the foods the author says drain your energy." },
  { id: "why-we-sleep", title: "Why We Sleep", author: "Matthew Walker", topics: ["sleep", "focus"], summary: "What sleep does for memory, mood and health, and what steals it, from a sleep scientist." },
  { id: "circadian-code", title: "The Circadian Code", author: "Satchin Panda", topics: ["timing", "fasting", "sleep"], summary: "Your body clock and why when you eat, sleep and see light matters as much as what you do." },
  { id: "glucose-revolution", title: "Glucose Revolution", author: "Jessie Inchauspé", topics: ["food", "focus"], summary: "Simple ways to flatten blood-sugar spikes, like eating vegetables first, for steadier energy." },
  { id: "good-energy", title: "Good Energy", author: "Casey Means", topics: ["food", "longevity"], summary: "Metabolic health as the root of energy and disease, and the daily habits that improve it." },
  { id: "outlive", title: "Outlive", author: "Peter Attia", topics: ["longevity", "movement", "food"], summary: "A doctor's plan for living longer and better: exercise first, then nutrition, sleep and emotional health." },
  { id: "spark", title: "Spark", author: "John Ratey", topics: ["movement", "focus", "stress"], summary: "How exercise changes the brain: better focus, mood and learning, and less anxiety." },
  { id: "breath", title: "Breath", author: "James Nestor", topics: ["stress", "sleep"], summary: "How we breathe, why most of us do it badly, and the slow, nasal breathing that calms the body." },
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", topics: ["habits"], summary: "Small changes that stick: make good habits obvious, easy and satisfying." },
];

/** A shelf pick: the book, and the topic it was chosen for. */
export interface ShelfPick {
  book: Book;
  because: LearnTopic;
}

/** Why a topic is on someone's shelf, in their terms. */
export const BECAUSE: Record<LearnTopic, string> = {
  sleep: "Sleep is pulling your Focus Score down most.",
  timing: "Late eating, screens or caffeine are costing you.",
  food: "Your food is the weak spot in your score.",
  stress: "Stress is weighing on your score.",
  movement: "You're moving less than your score wants.",
  fasting: "You're fasting.",
  supplements: "You're building a supplement stack.",
  focus: "For sharper thinking.",
  longevity: "For a long, healthy life.",
  habits: "For making the changes stick.",
};

/** Up to [limit] books for [topics], most important first: each topic's best book, then its others. */
export function shelfFor(topics: LearnTopic[], limit = 6): ShelfPick[] {
  const ordered = [...new Set([...topics, ...LEARN_TOPICS])];
  const picked: ShelfPick[] = [];
  const has = (b: Book) => picked.some((p) => p.book.id === b.id);
  // First pass: books whose main topic is the topic; second: any book that covers it.
  for (const pass of [0, 1]) {
    for (const topic of ordered) {
      for (const book of BOOKS) {
        if (picked.length >= limit) return picked;
        if (has(book)) continue;
        if (pass === 0 ? book.topics[0] === topic : book.topics.includes(topic)) {
          picked.push({ book, because: topic });
          if (pass === 0) break;
        }
      }
    }
  }
  return picked;
}

/** Store search links, with an affiliate tag when one is configured. */
export function bookLinks(book: Pick<Book, "title" | "author">, amazonTag?: string): { bookUrl: string; audioUrl: string } {
  const q = encodeURIComponent(`${book.title} ${book.author}`);
  return {
    bookUrl: `https://www.amazon.com/s?k=${q}&i=stripbooks${amazonTag ? `&tag=${encodeURIComponent(amazonTag)}` : ""}`,
    audioUrl: `https://www.audible.com/search?keywords=${q}`,
  };
}
