import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Admin } from "./Admin";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAdmin(...overrides: ReturnType<typeof createHandlers>) {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  server.use(...overrides);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Admin />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const row = (name: string) => screen.findByRole("listitem", { name });

describe("Admin", () => {
  it("lists products with their labels and filters them", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const glasses = await row("TrueDark evening glasses");
    expect(within(glasses).getByText("Affiliate link")).toBeInTheDocument();
    expect(within(await row("MitoProof apple cider vinegar capsules")).getByText("Our brand")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Our brand/ }));
    expect(screen.queryByRole("listitem", { name: "TrueDark evening glasses" })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "The Mitoproof Protocol" })).toBeInTheDocument();
  });

  it("swaps a product's link and can go back to the built-in one", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const glasses = await row("TrueDark evening glasses");
    const link = within(glasses).getByLabelText("Link");
    expect(link).toHaveValue("https://truedark.com/");

    await user.clear(link);
    await user.type(link, "https://truedark.com/?ref=neurocal");
    await user.click(within(glasses).getByRole("button", { name: "Save link" }));
    expect(await screen.findByText("Link saved")).toBeInTheDocument();
    expect(await within(await row("TrueDark evening glasses")).findByText(/Replaces the built-in link/)).toBeInTheDocument();

    await user.click(within(await row("TrueDark evening glasses")).getByRole("button", { name: "Use the built-in link" }));
    expect(await screen.findByText("Built-in link restored")).toBeInTheDocument();
    await waitFor(async () => expect(within(await row("TrueDark evening glasses")).getByLabelText("Link")).toHaveValue("https://truedark.com/"));
  });

  it("turns a product off and labels a link as affiliate", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const lmnt = await row("LMNT electrolyte drink mix");
    await user.click(within(lmnt).getByRole("checkbox", { name: "I earn a commission from this link" }));
    expect(await screen.findByText("Labelled as an affiliate link")).toBeInTheDocument();
    expect(await within(await row("LMNT electrolyte drink mix")).findByText("Affiliate link")).toBeInTheDocument();

    await user.click(within(await row("LMNT electrolyte drink mix")).getByRole("checkbox", { name: "Suggest this product" }));
    expect(await screen.findByText("Product turned off")).toBeInTheDocument();
    expect(await within(await row("LMNT electrolyte drink mix")).findByText("Turned off")).toBeInTheDocument();
  });

  it("adds an own-brand product and removes it again", async () => {
    const user = userEvent.setup();
    renderAdmin();
    await row("TrueDark evening glasses");
    await user.click(screen.getByRole("button", { name: "Add a product" }));
    const form = screen.getByRole("form", { name: "Add a product" });
    await user.type(within(form).getByLabelText("Name"), "MitoProof Vitamin ADK");
    await user.type(within(form).getByLabelText(/What it is/), "Vitamins A, D and K in one capsule.");
    await user.type(within(form).getByLabelText("Link"), "https://www.mitoproof.com/products/vitamin-adk");
    await user.type(within(form).getByLabelText(/Suggest it for/), "vitamins, energy");
    await user.click(within(form).getByRole("button", { name: "Add product" }));

    expect(await screen.findByText("Product added")).toBeInTheDocument();
    const added = await row("MitoProof Vitamin ADK");
    expect(within(added).getByText("Our brand")).toBeInTheDocument();
    expect(within(added).getByText("Added by you")).toBeInTheDocument();

    await user.click(within(added).getByRole("button", { name: "Remove product" }));
    expect(await screen.findByText("Product removed")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "MitoProof Vitamin ADK" })).not.toBeInTheDocument());
  });

  it("tells a non-admin the page isn't for them", async () => {
    renderAdmin(http.get(`${API_BASE}/admin/products`, () => HttpResponse.json({ code: "forbidden", message: "Only an admin can manage products." }, { status: 403 })));
    expect(await screen.findByRole("alert")).toHaveTextContent("This page is for admins");
    expect(screen.queryByRole("button", { name: "Add a product" })).not.toBeInTheDocument();
  });
});
