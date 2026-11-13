"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { TxProvider } from "@/components/tx-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, retry: 2, refetchOnWindowFocus: true },
        },
      }),
  );

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <TooltipProvider delayDuration={200}>
            <TxProvider>{children}</TxProvider>
          </TooltipProvider>
        </WalletProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface-raised)",
              color: "var(--foreground)",
              border: "1px solid var(--border-strong)",
            },
          }}
        />
      </QueryClientProvider>
    </>
  );
}
