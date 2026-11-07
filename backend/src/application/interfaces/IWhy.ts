import type { WhyReasons, WhyTopic } from "../../domain/why";

/** A fuller "Why?" for one result, from the data summary and the rule-based reasons. */
export interface IWhyExplainer {
  explain(input: { topic: WhyTopic; context: string; reasons: WhyReasons | null }): Promise<string>;
}

/** "Why?" explanations already written, one per person, topic and day; reused while the data is the same. */
export interface IWhyCache {
  get(userId: string, topic: WhyTopic, date: string): Promise<{ hash: string; text: string } | null>;
  put(userId: string, topic: WhyTopic, date: string, entry: { hash: string; text: string }): Promise<void>;
}
