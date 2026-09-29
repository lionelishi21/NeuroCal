import { vi } from "vitest";

/** Stand-in for next/navigation's router in unit tests (installed in setup.ts). */
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};
