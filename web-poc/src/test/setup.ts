import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { mockRouter } from "./router";

// Waiting for the mock API: one second is too tight when the machine is busy.
configure({ asyncUtilTimeout: 5000 });

vi.mock("next/navigation", () => ({ useRouter: () => mockRouter, usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// The log-meal preview needs object URLs; jsdom's shim can't read test Files.
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};
