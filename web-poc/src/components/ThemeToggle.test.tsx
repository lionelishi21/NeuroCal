import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_KEY } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("forces light or dark and remembers it, and Auto goes back to the device setting", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(screen.getByRole("button", { name: "Auto" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it("shows a saved choice on load", () => {
    localStorage.setItem(THEME_KEY, "light");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });
});
