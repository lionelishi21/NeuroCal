import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("walks through four steps and saves the profile", async () => {
    const user = userEvent.setup();
    let saved: unknown;
    renderWith(<Welcome />, true);
    server.use(
      http.put(`${API_BASE}/me/profile`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: "u1", ...(saved as object) });
      }),
    );

    expect(await screen.findByText(/Step 1 of 4/)).toBeInTheDocument();
    const next = () => screen.getByRole("button", { name: "Continue" });
    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText("Your name"), "Ada");
    await user.click(next());

    expect(screen.getByRole("heading", { name: "How do you eat?" })).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Keto/ }));
    await user.click(next());

    await user.click(screen.getByRole("button", { name: "Sharper focus" }));
    await user.click(next());

    const calories = screen.getByLabelText(/Calories per day/);
    await user.clear(calories);
    await user.type(calories, "2000");
    expect(screen.getByLabelText("Carbs")).toHaveValue(25); // keto split, recalculated from 2,000 kcal
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
    expect(saved).toMatchObject({
      displayName: "Ada",
      dietaryPreference: "keto",
      cognitiveGoals: ["focus"],
      dailyCalorieTarget: 2000,
      macroTargets: { proteinG: 125, carbsG: 25, fatG: 155 },
    });
    expect(screen.getByText("Profile saved")).toBeInTheDocument();
  });

  it("pre-fills everything when editing an existing profile", async () => {
    renderWith(<Welcome />, false);
    expect(await screen.findByText(/Edit profile\. Step 1 of 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveValue("Lionel");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
