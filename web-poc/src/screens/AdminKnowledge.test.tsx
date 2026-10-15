import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE } from "../api/client";
import { ToastProvider } from "../components/Toast";
import { createDb } from "../mocks/db";
import { createHandlers } from "../mocks/handlers";
import { AdminKnowledge } from "./AdminKnowledge";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderKnowledge() {
  server.use(...createHandlers(API_BASE, createDb({ newUser: false }), 0));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminKnowledge />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Admin knowledge", () => {
  it("shows techniques to review with where they were said, and approving one takes it off the list", async () => {
    const user = userEvent.setup();
    renderKnowledge();
    const queue = await screen.findByRole("list", { name: "Techniques to review" });
    const calf = within(queue).getByText("Do ten calf raises after meals").closest("li")!;
    expect(within(calf).getByText("Movement")).toBeInTheDocument();
    expect(within(calf).getByText(/leg injury/)).toBeInTheDocument();
    expect(within(calf).getByRole("link", { name: /Watch in/ })).toHaveAttribute("href", expect.stringContaining("#t=1290"));

    await user.click(within(calf).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Added to the routines")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Techniques to review" })).queryByText("Do ten calf raises after meals")).not.toBeInTheDocument();
  });

  it("asks for the transcript of a queued video", async () => {
    const user = userEvent.setup();
    renderKnowledge();
    const videos = await screen.findByRole("list", { name: "Videos" });
    const queued = within(videos).getByText(/new upload waiting/).closest("li")!;
    expect(within(queued).getByText("Waiting for a transcript")).toBeInTheDocument();
    await user.click(within(queued).getByRole("button", { name: "Add the transcript" }));
    const find = within(queued).getByRole("button", { name: "Find techniques" });
    expect(find).toBeDisabled();
    await user.type(within(queued).getByRole("textbox", { name: "Transcript" }), "word ".repeat(110));
    expect(find).toBeEnabled();
  });
});
