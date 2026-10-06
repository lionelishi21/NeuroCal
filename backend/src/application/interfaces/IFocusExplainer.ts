import type { FocusComponents } from "../../domain/types";

export interface IFocusExplainer {
  /** One or two plain sentences (≤ 300 chars) about what drives today's score. Built from the components only. */
  explain(input: { score: number; components: FocusComponents }): Promise<string>;
}
