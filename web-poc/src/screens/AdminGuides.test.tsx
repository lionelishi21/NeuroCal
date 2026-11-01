import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminGuides } from "./AdminGuides";

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
        <AdminGuides />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("AdminGuides", () => {
  it("edits a draft guide's text and publishes it", async () => {
    const user = userEvent.setup();
    renderScreen();
    const row = within(await screen.findByRole("list", { name: "Guides" })).getByRole("button", { name: /The Mitoproof Protocol/ });
    expect(row).toHaveTextContent("Draft");
    expect(row).toHaveTextContent("Our brand");

    const save = await screen.findByRole("button", { name: "Save guide" });
    expect(save).toBeDisabled();
    expect((screen.getByLabelText(/^Text/) as HTMLTextAreaElement).value).toContain("## Chapter 1: Why cellular energy matters");

    await user.clear(screen.getByLabelText("Title"));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent("A guide needs a title and text.");

    await user.type(screen.getByLabelText("Title"), "The Mitoproof Protocol");
    await user.click(screen.getByRole("radio", { name: "Published: everyone" }));
    await user.click(save);
    expect(await screen.findByText("Guide published")).toBeInTheDocument();
    expect(await within(screen.getByRole("list", { name: "Guides" })).findByText("Published")).toBeInTheDocument();
  });
});
