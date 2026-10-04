import { frictionNeed } from "../../domain/bioProfile";
import { NotFoundError } from "../../domain/errors";
import { computeFocusComponents } from "../../domain/focusScore";
import { localDateOf, previousDate } from "../../domain/localDay";
import { needText, weakPoints } from "../../domain/recommendations";
import type { Product, Protocol, WeakPoint } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IClock } from "../interfaces/IClock";
import type { IEmbeddingProvider } from "../interfaces/IEmbeddingProvider";
import type { ICheckInRepository, IMealRepository, IProfileRepository, ITelemetryRepository } from "../interfaces/IRepositories";
import { loadFocusInputs } from "./GetFocusScoreUseCase";

const LOOKBACK_DAYS = 7;

export interface ProtocolMatches {
  weakPoints: WeakPoint[];
  protocols: { item: Protocol; similarity: number }[];
  products: { item: Product; similarity: number }[];
}

/**
 * ARCHITECTURE §6.9: the week's weakest Focus Score inputs → one embedding per
 * weak point → nearest protocols and products (pgvector cosine), taken
 * round-robin so every weak point is addressed. The friction point from the
 * onboarding answers is searched for as well, ahead of the weak points.
 * Affiliate flags pass through untouched so every client can label them.
 *
 * Own-brand supplements come first: whenever a match for a weak point is
 * another brand's supplement, the closest own-brand supplement for that same
 * weak point is suggested instead, when there is one.
 */
export class GetProtocolsUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly meals: IMealRepository,
    private readonly checkIns: ICheckInRepository,
    private readonly telemetry: ITelemetryRepository,
    private readonly catalog: ICatalogRepository,
    private readonly embedder: IEmbeddingProvider,
    private readonly clock: IClock,
    private readonly limits = { protocols: 2, products: 2 },
  ) {}

  async execute(input: { userId: string }): Promise<ProtocolMatches> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");

    const dates = [localDateOf(this.clock.now(), profile.timeZone)];
    while (dates.length < LOOKBACK_DAYS) dates.unshift(previousDate(dates[0]!));
    const repos = { meals: this.meals, checkIns: this.checkIns, telemetry: this.telemetry };
    const week = await Promise.all(dates.map(async (date) => computeFocusComponents(await loadFocusInputs(repos, profile, date))));

    const points = weakPoints(week);
    // One query per weak point (one batched embedding call), so each gets its own
    // best match instead of the strongest one crowding the other out.
    // The friction point named in onboarding goes first: it is all there is to go on before a week of data exists.
    const friction = frictionNeed(profile.bioProfile);
    const needs = [...(friction ? [{ label: friction }] : []), ...points];
    const queries = needs.length ? needs.map((n) => needText([n], profile.cognitiveGoals)) : [needText([], profile.cognitiveGoals)];
    const vectors = await this.embedder.embed(queries);
    const [protocols, products] = await Promise.all([
      this.pickPerQuery(vectors, this.limits.protocols, (v, n) => this.catalog.nearestProtocols(v, n)),
      this.pickPerQuery(vectors, this.limits.products, (v, n) => this.ownSupplementsFirst(v, n)),
    ]);
    return { weakPoints: points, protocols, products };
  }

  /**
   * Nearest products for one weak point. When an own-brand supplement exists,
   * other brands' supplements are left out and the closest own-brand one takes
   * the place of the first of them (unless it is already in the list).
   */
  private async ownSupplementsFirst(vector: number[], n: number): Promise<{ item: Product; similarity: number }[]> {
    const [nearest, own] = await Promise.all([
      this.catalog.nearestProducts(vector, n),
      this.catalog.nearestProducts(vector, 1, "ownSupplements"),
    ]);
    const best = own[0];
    if (!best) return nearest;

    let placed = nearest.some((c) => c.item.id === best.item.id);
    const out: { item: Product; similarity: number }[] = [];
    for (const candidate of nearest) {
      if (candidate.item.supplement && !candidate.item.ownBrand) {
        if (!placed) out.push(best);
        placed = true;
        continue;
      }
      out.push(candidate);
    }
    return out;
  }

  /** Round-robin over the queries: each takes its best unseen match until `limit` is reached. */
  private async pickPerQuery<T extends { id: string }>(
    vectors: number[][],
    limit: number,
    nearest: (vector: number[], n: number) => Promise<{ item: T; similarity: number }[]>,
  ): Promise<{ item: T; similarity: number }[]> {
    const candidates = await Promise.all(vectors.map((v) => nearest(v, limit + vectors.length)));
    const picked: { item: T; similarity: number }[] = [];
    const seen = new Set<string>();
    for (let round = 0; picked.length < limit && round < limit + vectors.length; round++) {
      for (const list of candidates) {
        const next = list.find((c) => !seen.has(c.item.id));
        if (!next || picked.length >= limit) continue;
        seen.add(next.item.id);
        picked.push(next);
      }
    }
    return picked;
  }
}
