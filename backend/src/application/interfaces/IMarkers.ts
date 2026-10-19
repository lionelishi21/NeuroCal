import type { MarkerReading } from "../../domain/markers";

export type NewMarkerReading = Omit<MarkerReading, "id">;

/** Health marker readings. The same marker, time and source is kept once, so imports can repeat. */
export interface IMarkerRepository {
  add(userId: string, readings: NewMarkerReading[]): Promise<number>;
  /** Oldest first. */
  listSince(userId: string, since: Date): Promise<MarkerReading[]>;
  delete(userId: string, id: string): Promise<boolean>;
}
