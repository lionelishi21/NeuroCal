import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Today } from "./Today";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
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
    await user.click(screen.getAllByRole("button", { name: "Log a meal" })[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Log a meal" });
    await user.upload(within(sheet).getByLabelText(/Take or choose a photo/), new File(["x"], "dark-kitchen.jpg", { type: "image/jpeg" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("too dark");
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
