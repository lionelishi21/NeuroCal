import { InvalidError, NotFoundError } from "../../domain/errors";
import { MARKERS, MARKER_IDS, type MarkerSummary, summarize } from "../../domain/markers";
import type { IClock } from "../interfaces/IClock";
import type { IMarkerRepository, NewMarkerReading } from "../interfaces/IMarkers";

const DAY_MS = 86_400_000;
/** How far back the summaries look. */
const HISTORY_DAYS = 400;

/** Health markers: readings typed in or imported from the phone's health store, and a summary of each. */
export class MarkerUseCases {
  constructor(
    private readonly markers: IMarkerRepository,
    private readonly clock: IClock,
  ) {}

  /** A reading without [measuredAt] is taken as now. */
  async record(userId: string, input: (Omit<NewMarkerReading, "measuredAt"> & { measuredAt?: Date })[]): Promise<{ accepted: number }> {
    const now = this.clock.now();
    const latest = now.getTime() + DAY_MS;
    const readings = input.map((r) => ({ ...r, measuredAt: r.measuredAt ?? now }));
    for (const r of readings) {
      if (!MARKER_IDS.includes(r.marker)) throw new InvalidError("That isn't a marker NeuroCal tracks.");
      const def = MARKERS[r.marker];
      if (!Number.isFinite(r.value) || r.value < def.min || r.value > def.max) {
        throw new InvalidError(`${def.label} should be between ${def.min} and ${def.max} ${def.unit}.`);
      }
      if (r.measuredAt.getTime() > latest) throw new InvalidError("That date is in the future.");
    }
    return { accepted: await this.markers.add(userId, readings) };
  }

  async list(userId: string): Promise<MarkerSummary[]> {
    return summarize(await this.markers.listSince(userId, new Date(this.clock.now().getTime() - HISTORY_DAYS * DAY_MS)));
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.markers.delete(userId, id))) throw new NotFoundError("That reading is no longer there.");
  }
}
