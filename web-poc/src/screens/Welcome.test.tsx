import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BioProfile } from "@neurocal/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { mockRouter } from "../test/router";
import { Today } from "./Today";
import { Welcome } from "./Welcome";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWith(ui: React.ReactElement, newUser: boolean) {
  server.use(...createHandlers(API_BASE, createDb({ newUser }), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Onboarding", () => {
  it("sends a new user from Today to setup", async () => {
    renderWith(<Today />, true);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/welcome"));
  });

  // Eleven steps of typing and clicking: over the 5 s default when the whole suite runs.
  it("walks through the eleven bio-profile steps and saves the result", { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    let saved: unknown;
    renderWith(<Welcome />, true);
    server.use(
      http.put(`${API_BASE}/me/profile`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: "u1", ...(saved as object) });
      }),
    );

    expect(await screen.findByText("Step 1 of 11")).toBeInTheDocument();
    const next = () => screen.getByRole("button", { name: "Continue" });
    const choose = (name: string | RegExp) => user.click(screen.getByRole("radio", { name }));
    // "Yes" and "No" appear once per question on a step; pick by the question they belong to.
    const answer = (question: string | RegExp, name: string) =>
      user.click(within(screen.getByRole("radiogroup", { name: question })).getByRole("radio", { name }));

    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText("First name"), "Maya");
    // Devices are announced, not connectable yet.
    expect(screen.getAllByText("Coming soon")).toHaveLength(3);
    await user.click(next());

    expect(screen.getByRole("heading", { name: "When do you naturally wake up?" })).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await choose(/6–8 AM/);
    await user.click(next());

    expect(screen.getByText("Step 3 of 11")).toBeInTheDocument();
    await choose(/Cyclical keto/);
    expect(next()).toBeDisabled(); // fasting still to answer
    await choose("16:8");
    await user.click(next());

    // Coffee: the follow-up questions only appear for coffee drinkers.
    await choose("None");
    expect(screen.queryByText("When do you have it?")).not.toBeInTheDocument();
    await choose("Black");
    await choose("Before 9 AM");
    await answer(/mold-tested coffee/, "Yes");
    await user.click(next());

    await answer(/sensitive to mold/, "No");
    await answer(/screen time after sunset/, "1–2");
    await choose("Another room");
    await user.click(next());

    await choose("Tap water");
    await answer(/trace minerals/, "No");
    await user.click(next());

    await answer("Cold therapy", "Weekly");
    await answer(/Red light/, "Never");
    await answer(/PEMF/, "Never");
    await user.click(next());

    await answer("Do you take supplements?", "Yes");
    await user.click(screen.getByRole("button", { name: "C8 MCT" }));
    await user.click(screen.getByRole("button", { name: "Nootropics" }));
    await user.click(next());

    await choose(/REHIT or sprints/);
    await user.click(next());
    await choose("2:00 PM crashes");
    await user.click(next());

    // The last step shows what the answers add up to.
    expect(screen.getByText("Step 11 of 11")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save bio-profile" });
    expect(save).toBeDisabled();
    await choose(/Unshakable focus/);
    const card = screen.getByRole("region", { name: "Starting macro ratio" });
    expect(within(card).getByText("70%")).toBeInTheDocument(); // fat, cyclical keto
    expect(within(card).getByText("171 g")).toBeInTheDocument();
    expect(within(card).getByText("11:00–19:00 (16:8)")).toBeInTheDocument();
    expect(within(card).getByText("15:00")).toBeInTheDocument(); // caffeine curfew, eight hours after a 7:00 wake
    await user.click(save);

    expect(await screen.findByRole("heading", { name: "You're set, Maya." })).toBeInTheDocument();
    expect(screen.getByText("Bio-profile saved")).toBeInTheDocument();
    expect(saved).toMatchObject({
      displayName: "Maya",
      dietaryPreference: "cyclical_keto",
      cognitiveGoals: ["focus"],
      dailyCalorieTarget: 2200,
      macroTargets: { fatG: 171, proteinG: 110, carbsG: 55 },
      bioProfile: {
        wake: "6_to_8",
        fasting: "16_8",
        coffeeType: "black",
        coffeeTime: "before_9",
        coffeeMoldTested: true,
        moldSensitive: false,
        eveningScreens: "1_2",
        phoneAtNight: "another_room",
        water: "tap",
        addsMinerals: false,
        coldTherapy: "weekly",
        redLight: "never",
        pemf: "never",
        takesSupplements: true,
        supplements: ["c8_mct", "nootropics"],
        movement: "rehit",
        friction: "afternoon_crash",
        goal: "focus",
      },
    });
    // The saved answers are what the API contract accepts.
    expect(BioProfile.safeParse((saved as { bioProfile: unknown }).bioProfile).success).toBe(true);

    await user.click(screen.getByRole("button", { name: "Go to Today" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("pre-fills everything when editing an existing profile", async () => {
    renderWith(<Welcome />, false);
    expect(await screen.findByText(/Edit profile\. Step 1 of 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveValue("Lionel");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
