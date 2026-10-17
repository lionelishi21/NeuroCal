import type { DeviceCandidate, DeviceStatus, DeviceTag } from "../../domain/devices";

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

/** A general web search (Tavily). */
export interface IWebSearch {
  search(query: string, opts: { limit: number }): Promise<WebResult[]>;
}

export type FoundDevice = Pick<DeviceCandidate, "name" | "maker" | "url" | "description">;

/** Search results → specific devices in a category (an LLM; its output is schema-checked). */
export interface IDeviceExtractor {
  extract(input: { category: string; results: WebResult[] }): Promise<FoundDevice[]>;
}

/** Devices the scout found, for the admin Devices screen. */
export interface IDeviceCandidateRepository {
  /** Newest first. */
  list(): Promise<DeviceCandidate[]>;
  get(id: string): Promise<DeviceCandidate | null>;
  add(devices: (FoundDevice & { tag: DeviceTag })[]): Promise<DeviceCandidate[]>;
  update(id: string, patch: Partial<Pick<DeviceCandidate, "name" | "description" | "url">> & { status: DeviceStatus; productId?: string }): Promise<DeviceCandidate>;
}
