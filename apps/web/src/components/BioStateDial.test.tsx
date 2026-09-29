import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BioStateDial } from "./BioStateDial";

const macros = { proteinG: 50, carbsG: 100, fatG: 30 };
const targets = { proteinG: 130, carbsG: 240, fatG: 75 };

describe("BioStateDial", () => {
  it("shows calories left with an accessible summary", () => {
    render(<BioStateDial calorieTarget={2200} caloriesEaten={1050} macrosEaten={macros} macroTargets={targets} />);
    expect(screen.getByRole("img", { name: "1,150 kcal left of 2,200 kcal today" })).toBeInTheDocument();
    expect(screen.getByText("kcal left")).toBeInTheDocument();
  });

  it("switches to an over-budget reading", () => {
    render(<BioStateDial calorieTarget={2000} caloriesEaten={2150} macrosEaten={macros} macroTargets={targets} />);
    expect(screen.getByRole("img", { name: "150 kcal over today's 2,000 kcal budget" })).toBeInTheDocument();
    expect(screen.getByText("kcal over")).toBeInTheDocument();
  });

  it("draws one tick per 50 kcal of budget", () => {
    const { container } = render(
      <BioStateDial calorieTarget={2200} caloriesEaten={0} macrosEaten={macros} macroTargets={targets} />,
    );
    expect(container.querySelectorAll("line")).toHaveLength(44);
  });
});
