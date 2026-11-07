import type { ChatTurn } from "../../domain/coach";

/** Answers a question about someone's own data (Ask NeuroCal), from a summary of that data. */
export interface ICoach {
  /** [context]: coachContext's summary. [turns]: the conversation so far, ending with the question. */
  reply(input: { context: string; turns: ChatTurn[] }): Promise<string>;
}
