import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Sleep } from "./Sleep";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSleep(db = createDb()) {
  server.use(...createHandlers(API_BASE, db, 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Sleep />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Sleep", () => {
  it("shows seven nights with the evening before each one", async () => {
    renderSleep();
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(8); // header + 7 nights
    // Last night in the seed: dinner at 21:30, 6.5 hours of sleep, no screen time logged yet.
    expect(within(rows[1]!).getByRole("rowheader")).toHaveTextContent("Last night");
    expect(within(rows[1]!).getByText("6 h 30 min")).toBeInTheDocument();
    // Four nights ago: 75 minutes of screens, then 6 hours of sleep.
    expect(within(rows[4]!).getByText("75 min")).toBeInTheDocument();
    expect(within(rows[4]!).getByText("6 h 00 min")).toBeInTheDocument();
  });

  it("says what late dinners and late screens did to sleep", async () => {
    renderSleep();
    const insights = await screen.findByRole("region", { name: "What your evenings did" });
    // Late dinners were followed by 5.5 h, 6 h and 6.5 h; the earlier ones by 8 h, 7.5 h and 7 h.
    expect(within(insights).getByText(/the 3 nights you ate after 9pm, you slept 6 h 00 min on average. That is 1 h 30 min less/)).toBeInTheDocument();
    expect(within(insights).getByText(/screens after 10pm on 3 nights/)).toBeInTheDocument();
    expect(screen.getByText("3 of 7")).toBeInTheDocument();
  });

  it("logs last night's screen time", async () => {
    const user = userEvent.setup();
    renderSleep();
    const table = await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Log screen time" }));
    const sheet = await screen.findByRole("dialog", { name: "Log screen time" });
    await user.click(within(sheet).getByRole("button", { name: "90 min" }));
    await user.click(within(sheet).getByRole("button", { name: "Log screen time" }));

    expect(await screen.findByText("Screen time logged")).toBeInTheDocument();
    expect(await within(within(table).getAllByRole("row")[1]!).findByText("90 min")).toBeInTheDocument();
  });

  it("draws a new user's first night", async () => {
    const db = createDb({ newUser: true });
    db.updateProfile({
      displayName: "Sam",
      dietaryPreference: "vegan",
      dailyCalorieTarget: 2000,
      macroTargets: { proteinG: 100, carbsG: 250, fatG: 60 },
    });
    renderSleep(db);
    // The seed gives even a new user the night that ended this morning.
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("6 h 30 min")).toHaveLength(1);
    expect(screen.getByText("0 of 7")).toBeInTheDocument();
  });
});
