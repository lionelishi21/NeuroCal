import { describe, expect, it } from "vitest";
import { withoutTrailingSlash } from "./path";

describe("withoutTrailingSlash", () => {
  it("drops the slash the deployed site adds, keeping the root", () => {
    expect(withoutTrailingSlash("/sign-in/")).toBe("/sign-in");
    expect(withoutTrailingSlash("/admin/funnel")).toBe("/admin/funnel");
    expect(withoutTrailingSlash("/")).toBe("/");
  });
});
