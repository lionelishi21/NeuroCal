import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ToastProvider } from "./components/Toast";
import { router } from "./router";
import "./styles/app.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

async function startMocks() {
  if (import.meta.env.VITE_API_URL) return;
  const [{ setupWorker }, { createHandlers }] = await Promise.all([import("msw/browser"), import("./mocks/handlers")]);
  await setupWorker(...createHandlers()).start({ onUnhandledRequest: "bypass", quiet: true });
}

startMocks().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
