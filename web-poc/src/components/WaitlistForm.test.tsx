import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { Unsubscribe } from "../screens/Unsubscribe";
import { WaitlistForm } from "./WaitlistForm";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.history.replaceState(null, "", "/");
});
afterAll(() => server.close());

function renderWith(ui: React.ReactNode, ...overrides: ReturnType<typeof createHandlers>) {
  server.use(...createHandlers(API_BASE, createDb(), 0));
  server.use(...overrides);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

describe("WaitlistForm", () => {
  it("asks for a real address before sending anything", async () => {
    const user = userEvent.setup();
    let sent = 0;
    renderWith(<WaitlistForm />, http.post(`${API_BASE}/waitlist`, () => (sent++, HttpResponse.json({ status: "joined" }, { status: 201 }))));
    await user.type(screen.getByLabelText("Email address"), "sam@");
    await user.click(screen.getByRole("button", { name: "Tell me when it's ready" }));
    expect(screen.getByText(/Enter your email address/)).toBeInTheDocument();
    expect(sent).toBe(0);
  });

  it("sends the address and the phone, then says they're on the list", async () => {
    const user = userEvent.setup();
    let received: unknown;
    renderWith(
      <WaitlistForm />,
      http.post(`${API_BASE}/waitlist`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ status: "joined" }, { status: 201 });
      }),
    );
    await user.type(screen.getByLabelText("Email address"), " sam@example.com ");
    await user.click(screen.getByRole("button", { name: "Android" }));
    await user.click(screen.getByRole("button", { name: "Tell me when it's ready" }));

    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
    expect(screen.getByText(/We'll email sam@example.com/)).toBeInTheDocument();
    expect(received).toEqual({ email: "sam@example.com", platform: "android" });
  });

  it("keeps the form and says what to do when the list can't be reached", async () => {
    const user = userEvent.setup();
    renderWith(<WaitlistForm />, http.post(`${API_BASE}/waitlist`, () => HttpResponse.error()));
    await user.type(screen.getByLabelText("Email address"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Tell me when it's ready" }));
    expect(await screen.findByText(/Couldn't add you to the list/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveValue("sam@example.com");
  });
});

describe("Unsubscribe", () => {
  it("leaves the list only when asked, with the token from the link", async () => {
    const user = userEvent.setup();
    let received: unknown;
    window.history.replaceState(null, "", "/unsubscribe?token=0123456789abcdef0123456789abcdef");
    renderWith(
      <Unsubscribe />,
      http.post(`${API_BASE}/waitlist/unsubscribe`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ status: "unsubscribed" });
      }),
    );
    expect(await screen.findByRole("heading", { name: "Leave the NeuroCal list?" })).toBeInTheDocument();
    expect(received).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(await screen.findByRole("heading", { name: "You're off the list" })).toBeInTheDocument();
    expect(received).toEqual({ token: "0123456789abcdef0123456789abcdef" });
  });

  it("says so when the link has no token", async () => {
    renderWith(<Unsubscribe />);
    expect(await screen.findByRole("heading", { name: "This link isn't complete" })).toBeInTheDocument();
  });
});
