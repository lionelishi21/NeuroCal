import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminDashboard } from "./AdminDashboard";
import { AdminWaitlist } from "./AdminWaitlist";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWith(ui: React.ReactElement) {
  server.use(...createHandlers(API_BASE, createDb({ newUser: false }), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Admin dashboard", () => {
  it("shows the waitlist and products at a glance", async () => {
    renderWith(<AdminDashboard />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    const newest = await screen.findByRole("region", { name: "Newest sign-ups" });
    expect(await within(newest).findByText("priya@example.com")).toBeInTheDocument();
    // The mock has four people on the list and one who unsubscribed.
    expect(screen.getByText("On the waitlist").nextSibling).toHaveTextContent("4");
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/admin/products");
  });

  it("filters the waitlist", async () => {
    const user = userEvent.setup();
    renderWith(<AdminWaitlist />);
    expect(await screen.findByText("marcus@example.com")).toBeInTheDocument();
    expect(screen.queryByText("sam@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unsubscribed" }));
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
    expect(screen.queryByText("marcus@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Everyone" }));
    await user.type(screen.getByRole("searchbox", { name: "Search by email" }), "zzz");
    expect(screen.getByText("No one matches")).toBeInTheDocument();
  });
});
