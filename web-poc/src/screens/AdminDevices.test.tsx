import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminDevices } from "./AdminDevices";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDevices() {
  server.use(...createHandlers(API_BASE, createDb({ newUser: false }), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminDevices />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Admin devices", () => {
  it("approving a device with edits adds it to products; dismissing one moves it to reviewed", async () => {
    const user = userEvent.setup();
    renderDevices();
    const queue = await screen.findByRole("list", { name: "Devices to review" });
    const fryer = within(queue).getByText("Sample ceramic air fryer AF-200").closest("li")!;
    expect(within(fryer).getByText("Air fryer")).toBeInTheDocument();
    expect(within(fryer).getByRole("link", { name: "Open the product page" })).toHaveAttribute("href", "https://example.com/air-fryer-af200");

    await user.click(within(fryer).getByRole("button", { name: "Edit" }));
    const name = within(fryer).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Ceramic air fryer");
    await user.click(within(fryer).getByRole("button", { name: "Approve with edits" }));
    expect(await screen.findByText("Added to products", { selector: "[role=status] *, [role=status]" })).toBeInTheDocument();

    const filter = within(await screen.findByRole("list", { name: "Devices to review" })).getByText("Sample countertop filter CF-5").closest("li")!;
    await user.click(within(filter).getByRole("button", { name: "Dismiss" }));
    const reviewed = await screen.findByRole("list", { name: "Reviewed devices" });
    expect(await within(reviewed).findByText("Sample countertop filter CF-5")).toBeInTheDocument();
    expect(within(reviewed).getByText("Ceramic air fryer")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to review/)).toBeInTheDocument();
  });
});
