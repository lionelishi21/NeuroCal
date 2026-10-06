import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE, request } from "../api/client";
import { AuthProvider, RequireAuth, nextPath, useAuth } from "../auth/AuthProvider";
import { Landing } from "./Landing";
import { MOCK_CODE, createMockAuth } from "../auth/mockAuth";
import type { AuthClient } from "../auth/types";
import { ToastProvider } from "../components/Toast";
import { mockRouter } from "../test/router";
import { SignIn, SignUp } from "./Account";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());

function renderWith(ui: React.ReactElement, client: AuthClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const Status = () => <p>status: {useAuth().status}</p>;

describe("Account", () => {
  it("sends a signed-out visitor to sign in and hides the page", async () => {
    renderWith(
      <RequireAuth>
        <p>Private page</p>
      </RequireAuth>,
      createMockAuth(null),
    );
    // The first visit on a device starts with the intro.
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/intro"));
    expect(screen.queryByText("Private page")).not.toBeInTheDocument();
  });

  it("sends a returning signed-out visitor straight to sign in", async () => {
    window.localStorage.setItem("neurocal-intro-seen", "1");
    renderWith(
      <RequireAuth>
        <p>Private page</p>
      </RequireAuth>,
      createMockAuth(null),
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/sign-in"));
  });

  it("shows the landing page at the home page instead of redirecting, until someone signs in", async () => {
    const client = createMockAuth(null);
    renderWith(
      <RequireAuth landing={<Landing />}>
        <p>Private page</p>
      </RequireAuth>,
      client,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Know why your afternoon falls apart." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Start free" })[0]).toHaveAttribute("href", "/sign-up");
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByText("Private page")).not.toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    // Pro in dollars: $8 a month, 30% less by the year.
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "US dollars" }));
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$67")).toBeInTheDocument();
    expect(screen.getByText("a year · $5.60 a month")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(screen.getByText("$8")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Pounds" }));
    expect(screen.getByText("£6")).toBeInTheDocument();
  });

  it("creates an account, verifies the email and signs in", async () => {
    const user = userEvent.setup();
    const auth = createMockAuth(null);
    renderWith(
      <>
        <SignUp />
        <Status />
      </>,
      auth,
    );

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    // The rule counts along, and the button waits for ten characters.
    expect(screen.getByText("At least 10 characters · 5 so far")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.type(screen.getByLabelText("Password"), "-but-longer");
    expect(screen.getByText("At least 10 characters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();

    const code = screen.getByLabelText("Six-digit code");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await user.type(code, "000000");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Wrong code\..*Check the email and try again\./);

    await user.clear(code);
    await user.type(code, MOCK_CODE);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
    expect(await screen.findByText("status: signedIn")).toBeInTheDocument();
    expect(screen.getByText("Account created")).toBeInTheDocument();
  });

  it("offers sign-in when the email already has an account", async () => {
    const user = userEvent.setup();
    const auth = createMockAuth(null);
    await auth.signUp("sam@example.com", "correct-horse");
    renderWith(<SignUp />, auth);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "another-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have an account.");
    expect(screen.getByRole("link", { name: "Sign in instead" })).toHaveAttribute("href", "/sign-in");
  });

  it("explains a wrong password and signs in with the right one", async () => {
    const user = userEvent.setup();
    const auth = createMockAuth(null);
    await auth.signUp("sam@example.com", "correct-horse");
    await auth.confirmSignUp("sam@example.com", MOCK_CODE);
    renderWith(<SignIn />, auth);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Those details don't match.");

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
  });

  it("asks an unverified account for its code when signing in", async () => {
    const user = userEvent.setup();
    const auth = createMockAuth(null);
    await auth.signUp("sam@example.com", "correct-horse");
    renderWith(<SignIn />, auth);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  });

  it("sends the ID token with API calls and signs out on a 401", async () => {
    const auth = createMockAuth(null);
    await auth.signUp("sam@example.com", "correct-horse");
    await auth.confirmSignUp("sam@example.com", MOCK_CODE);
    await auth.signIn("sam@example.com", "correct-horse");
    let seen: string | null = null;
    server.use(
      http.get(`${API_BASE}/ok`, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
      http.get(`${API_BASE}/expired`, () => HttpResponse.json({ code: "unauthorized", message: "Sign in again." }, { status: 401 })),
    );
    renderWith(<Status />, auth);
    expect(await screen.findByText("status: signedIn")).toBeInTheDocument();

    await request("/ok", z.object({ ok: z.boolean() }));
    expect(seen).toBe(`Bearer ${await auth.idToken()}`);

    await expect(request("/expired", z.unknown())).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(await screen.findByText("status: signedOut")).toBeInTheDocument();
  });

  it("only returns to same-site paths after sign-in", () => {
    expect(nextPath("?next=%2Fhistory")).toBe("/history");
    expect(nextPath("?next=%2F%2Fevil.example")).toBe("/");
    expect(nextPath("?next=https%3A%2F%2Fevil.example")).toBe("/");
    expect(nextPath("")).toBe("/");
  });
});
