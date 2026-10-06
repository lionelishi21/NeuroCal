"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, RequireAuth } from "../auth/AuthProvider";
import { OfflineMealSync } from "../components/OfflineMeals";
import { TabBar } from "../components/TabBar";
import { ToastProvider } from "../components/Toast";
import { watchInstallPrompt } from "../lib/install";
import { applyTheme, storedTheme } from "../lib/theme";

// Without a real API, the app runs on the MSW mock API (browser-only, never bundled for the server).
const MockGate = process.env.NEXT_PUBLIC_API_URL ? null : dynamic(() => import("../mocks/MockGate"), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  // Keeps the appearance chosen in Settings (the inline script in layout.tsx sets it before first paint).
  useEffect(() => applyTheme(storedTheme()), []);
  useEffect(() => watchInstallPrompt(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RequireAuth>
            {MockGate ? (
              <MockGate>
                <OfflineMealSync />
                {children}
                <TabBar />
              </MockGate>
            ) : (
              <>
                <OfflineMealSync />
                {children}
                <TabBar />
              </>
            )}
          </RequireAuth>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
