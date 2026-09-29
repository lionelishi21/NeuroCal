import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Today } from "./Today";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderToday() {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Today />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Today", () => {
  it("shows the day's meals, check-in and a suggestion", async () => {
    renderToday();
    const meals = await screen.findByRole("region", { name: "Meals today" });
    expect(await within(meals).findByText("Breakfast")).toBeInTheDocument();
    expect(within(meals).getByText("Lunch")).toBeInTheDocument();
    expect(await screen.findByText("Low focus")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Miso-glazed cod/ })).toBeInTheDocument();
  });

  it("logs a meal from a photo", async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByText("Breakfast");

    await user.click(screen.getAllByRole("button", { name: "Log a meal" })[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Log a meal" });
    await user.upload(within(sheet).getByLabelText(/Take or choose a photo/), new File(["x"], "plate.jpg", { type: "image/jpeg" }));

    const logButton = await within(sheet).findByRole("button", { name: /^Log meal, / });
    await user.click(within(sheet).getAllByRole("checkbox")[0]!);
    await user.click(logButton);

    expect(await screen.findByText("Meal logged")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const meals = screen.getByRole("region", { name: "Meals today" });
    expect(await within(meals).findAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("explains a photo that can't be read", async () => {
    const user = userEvent.setup();
    renderToday();
    server.use(http.post(`${API_BASE}/meals/analyze`, () => HttpResponse.json({ items: [], problem: "too_dark" })));
    await user.click(screen.getAllByRole("button", { name: "Log a meal" })[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Log a meal" });
    await user.upload(within(sheet).getByLabelText(/Take or choose a photo/), new File(["x"], "plate.jpg", { type: "image/jpeg" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("too dark");
  });

  it("shows the Focus Score with its inputs and explanation", async () => {
    renderToday();
    const focus = await screen.findByRole("region", { name: "Focus today" });
    expect(await within(focus).findByText("out of 100")).toBeInTheDocument();
    expect(within(focus).getByText("Sleep")).toBeInTheDocument();
    expect(within(focus).getAllByText("No data")).toHaveLength(2); // timing and glycemic: nothing logged yesterday
    expect(within(focus).getByText(/holding your focus back/)).toBeInTheDocument();
  });

  it("logs sleep and refreshes the Focus Score", async () => {
    // Midday, so a 06:00 wake-up is always in the past. Only Date is faked; timers stay real.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 8, 29, 12, 0) });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const user = userEvent.setup();
    renderToday();
    const focus = await screen.findByRole("region", { name: "Focus today" });
    const before = (await within(focus).findByText("out of 100")).previousSibling?.textContent;

    await user.click(within(focus).getByRole("button", { name: "Log sleep" }));
    const sheet = await screen.findByRole("dialog", { name: "Log sleep" });
    const bed = within(sheet).getByLabelText("Went to bed");
    const wake = within(sheet).getByLabelText("Woke up");
    await user.clear(bed);
    await user.type(bed, "22:00");
    await user.clear(wake);
    await user.type(wake, "06:00");
    expect(within(sheet).getByText("8 h 00 min")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Log sleep" }));

    expect(await screen.findByText("Sleep logged")).toBeInTheDocument();
    await waitFor(() => expect(within(focus).getByText("out of 100").previousSibling?.textContent).not.toBe(before));
  });

  it("saves a check-in", async () => {
    const user = userEvent.setup();
    renderToday();
    await user.click(screen.getAllByRole("button", { name: "Check in" })[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Check in" });
    await user.click(within(sheet).getByRole("button", { name: "Sharp" }));
    await user.click(within(sheet).getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByText("Check-in saved")).toBeInTheDocument();
  });
});
