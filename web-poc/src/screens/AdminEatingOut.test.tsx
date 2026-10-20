import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminEatingOut } from "./AdminEatingOut";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderScreen() {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminEatingOut />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(new RegExp(`^${label}`));
    await user.clear(input);
    await user.type(input, value);
  }
}

describe("AdminEatingOut", () => {
  it("adds an item copied from a chain's page, flags figures that don't add up, and removes it", async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText(/Nothing added yet/)).toBeInTheDocument();

    await fill(user, { Chain: "KFC", Item: "Zinger burger", Portion: "1 burger", Weight: "205", Energy: "4500", Protein: "28", Carbs: "41", Fat: "19", "Link to": "https://www.kfc.co.uk/nutrition" });
    expect(screen.getByText(/Protein, carbs and fat make about 447 kcal/)).toHaveTextContent("far from the energy above");
    await user.click(screen.getByRole("button", { name: "Save item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The calories don't add up");

    await fill(user, { Energy: "450" });
    await user.click(screen.getByRole("button", { name: "Save item" }));
    expect(await screen.findByText("Zinger burger saved")).toBeInTheDocument();
    const group = await screen.findByRole("list", { name: "KFC · United Kingdom" });
    const row = within(group).getByRole("listitem", { name: "Zinger burger" });
    expect(row).toHaveTextContent("1 burger (205 g) · 450 kcal");
    // The chain and country stay for the next item from the same menu.
    expect(screen.getByLabelText(/^Chain/)).toHaveValue("KFC");

    await user.click(within(row).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText(/Nothing added yet/)).toBeInTheDocument();
  });

  it("asks for the missing fields before saving", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(/Nothing added yet/);
    await user.click(screen.getByRole("button", { name: "Save item" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Fill in the chain, item, portion, the five numbers and the link.");
  });
});
