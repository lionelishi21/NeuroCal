import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// The log-meal preview needs object URLs; jsdom's shim can't read test Files.
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};
