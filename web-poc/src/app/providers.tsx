"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "../components/Toast";

// Without a real API, the app runs on the MSW mock API (browser-only, never bundled for the server).
const MockGate = process.env.NEXT_PUBLIC_API_URL ? null : dynamic(() => import("../mocks/MockGate"), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{MockGate ? <MockGate>{children}</MockGate> : children}</ToastProvider>
    </QueryClientProvider>
  );
}
