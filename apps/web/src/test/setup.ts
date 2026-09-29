import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no object URLs; the log-meal preview needs them.
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
