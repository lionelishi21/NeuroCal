import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { History } from "./History";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderHistory() {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <History />
    </QueryClientProvider>,
  );
}

describe("History", () => {
  it("shows seven days in the table and today in the readout", async () => {
    renderHistory();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(8); // header + 7 days
    const readout = screen.getByRole("region", { name: "Selected day" });
    expect(within(readout).getByText("Focus Score")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today|^\w+day/, pressed: true })).toBeInTheDocument();
  });

  it("suggests protocols for the week's weak points and labels affiliate links", async () => {
    renderHistory();
    const help = await screen.findByRole("region", { name: "What could help" });
    expect(await within(help).findByText(/held your Focus Score back most/)).toBeInTheDocument();
    expect(within(help).getAllByRole("article").length).toBeGreaterThan(0);
    expect(within(help).getAllByRole("listitem").length).toBeGreaterThan(2); // steps and tools
    const link = within(help).getByRole("link", { name: "View sunrise alarm clock" });
    expect(link).toHaveAttribute("rel", expect.stringContaining("sponsored"));
    expect(within(help).getByText("Affiliate link")).toBeInTheDocument();
    expect(within(help).getByText(/may earn a commission/)).toBeInTheDocument();
  });

  it("labels products from NeuroCal's own brand", async () => {
    renderHistory();
    const help = await screen.findByRole("region", { name: "What could help" });
    const link = await within(help).findByRole("link", { name: "View the mitoproof protocol" });
    expect(link).toHaveAttribute("rel", expect.stringContaining("sponsored"));
    expect(within(help).getAllByText("Our brand").length).toBeGreaterThan(0);
    expect(within(help).getByText(/run by the people who make NeuroCal/)).toBeInTheDocument();
  });

  it("adds a safety note when a supplement is suggested", async () => {
    renderHistory();
    const help = await screen.findByRole("region", { name: "What could help" });
    expect(await within(help).findByText("MitoProof apple cider vinegar capsules")).toBeInTheDocument();
    expect(within(help).getByText(/Check with your doctor or pharmacist/)).toBeInTheDocument();
  });

  it("switches the readout to the chosen day", async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByRole("table");
    const dayButtons = within(screen.getByRole("group", { name: "Choose a day" })).getAllByRole("button");
    expect(dayButtons).toHaveLength(7);

    // Four days ago in the seed: 5.5 h of sleep, dinner at 22:10.
    await user.click(dayButtons[2]!);
    const readout = screen.getByRole("region", { name: "Selected day" });
    expect(within(readout).getByText("5 h 30 min")).toBeInTheDocument();
    expect(dayButtons[2]).toHaveAttribute("aria-pressed", "true");
  });
});
