import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { mockRouter } from "./router";

vi.mock("next/navigation", () => ({ useRouter: () => mockRouter, usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// The log-meal preview needs object URLs; jsdom's shim can't read test Files.
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};
