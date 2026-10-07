import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE } from "../api/client";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminOnly } from "./AdminOnly";
import { AuthProvider } from "./AuthProvider";
import type { AuthClient } from "./types";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSignedIn(...overrides: ReturnType<typeof createHandlers>) {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  server.use(...overrides);
  const signOut = vi.fn(async () => {});
  const client = { currentUser: async () => ({ email: "sam@example.com" }), idToken: async () => "token", signOut } as unknown as AuthClient;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider client={client}>
        <AdminOnly>
          <p>The app</p>
        </AdminOnly>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { signOut };
}

describe("AdminOnly", () => {
  it("lets an admin through once the API has confirmed them", async () => {
    let asked = false;
    renderSignedIn(
      http.get(`${API_BASE}/admin/products`, () => {
        asked = true;
        return HttpResponse.json({ products: [] });
      }),
    );
    await waitFor(() => expect(asked).toBe(true));
    expect(await screen.findByText("The app")).toBeInTheDocument();
  });

  it("tells anyone else the web app is for the team, and signs them out when asked", async () => {
    const { signOut } = renderSignedIn(http.get(`${API_BASE}/admin/products`, () => HttpResponse.json({ code: "forbidden", message: "Only an admin can manage products." }, { status: 403 })));
    expect(await screen.findByRole("heading", { name: "NeuroCal lives on your phone." })).toBeInTheDocument();
    expect(screen.getByText(/sam@example.com isn't an admin account/)).toBeInTheDocument();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("offers a retry when the check itself fails", async () => {
    renderSignedIn(http.get(`${API_BASE}/admin/products`, () => HttpResponse.json({ code: "upstream", message: "Try again." }, { status: 503 })));
    expect(await screen.findByText("Couldn't check your account")).toBeInTheDocument();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
  });
});
