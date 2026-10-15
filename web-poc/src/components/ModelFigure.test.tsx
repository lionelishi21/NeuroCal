import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelFigure } from "./ModelFigure";

describe("ModelFigure", () => {
  it("shows the seven pillars, the scored signals with their weights, and what isn't scored yet", () => {
    render(<ModelFigure />);
    const pillars = within(screen.getByRole("list", { name: "Seven pillars and the signals they feed" })).getAllByRole("listitem");
    expect(pillars.map((p) => p.querySelector("span")?.textContent)).toEqual([
      "Fuel",
      "Rhythm",
      "Recovery",
      "Mind",
      "Movement",
      "Environment",
      "Supplements",
    ]);
    // The weights match the Focus Score as built (backend domain/focusScore.ts, model v1).
    expect(within(pillars[2]!).getByText("35%")).toBeInTheDocument();
    expect(within(pillars[1]!).getByText("20%")).toBeInTheDocument();
    for (const i of [0, 3, 4]) expect(within(pillars[i]!).getByText("15%")).toBeInTheDocument();
    expect(within(pillars[6]!).getByText("Safety checks, not scored")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The loop" })).toHaveTextContent("Next action");
  });
});
