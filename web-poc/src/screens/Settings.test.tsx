import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { AuthProvider } from "../auth/AuthProvider";
import { createMockAuth } from "../auth/mockAuth";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Settings } from "./Settings";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterAll(() => server.close());

function renderSettings() {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider client={createMockAuth()}>
          <Settings />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Settings", () => {
  it("shows the profile with a link to edit it", async () => {
    renderSettings();
    const profile = screen.getByRole("region", { name: "Profile" });
    expect(await within(profile).findByText("Lionel")).toBeInTheDocument();
    expect(within(profile).getByText("Pescatarian")).toBeInTheDocument();
    expect(within(profile).getByText("Sharper focus, Steadier energy")).toBeInTheDocument();
    expect(within(profile).getByText("2,200 kcal")).toBeInTheDocument();
    expect(within(profile).getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/welcome");
  });

  it("switches the appearance and remembers it", async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("neurocal-theme")).toBe("light");

    await user.click(screen.getByRole("radio", { name: "Match device" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem("neurocal-theme")).toBeNull();
  });

  it("signs out from the account section", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
  });
});
