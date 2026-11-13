"use client";

/**
 * Every transaction in the app goes through this one flow:
 * simulate → show the summary, fee and any error → wallet prompt → send.
 * Nothing reaches the wallet before the simulation has passed.
 */
import { useQueryClient } from "@tanstack/react-query";
import { rpc } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { parseError, type FriendlyError } from "@/lib/errors";
import { formatFee } from "@/lib/format";
import { explorer } from "@/lib/network";
import type { Signer } from "@/lib/treasury";
import { useWallet } from "@/lib/wallet";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Notice } from "./ui/misc";

export interface TxRequest<T = unknown> {
  /** What the dialog is called, for example "Approve proposal #3". */
  title: string;
  /** Plain-words account of what signing will do. */
  summary?: ReactNode;
  /** The verb on the confirm button, for example "Approve". */
  confirmLabel: string;
  /** The toast after success, for example "Approved". */
  successLabel: string;
  build: (signer: Signer) => Promise<AssembledTransaction<T>>;
  /** Treasury whose cached data should refresh afterwards. */
  treasuryId?: string;
  onSuccess?: (outcome: { hash: string; assembled: AssembledTransaction<T>; result: unknown }) => void;
}

type Phase =
  | { name: "simulating" }
  | { name: "ready"; fee: string }
  | { name: "signing" }
  | { name: "sending" }
  | { name: "failed"; error: FriendlyError; stage: "simulation" | "send" };

const Context = createContext<{ run: <T>(request: TxRequest<T>) => void } | null>(null);

export function useTx() {
  const context = useContext(Context);
  if (!context) throw new Error("useTx must be used inside <TxProvider>");
  return context;
}

export function TxProvider({ children }: { children: ReactNode }) {
  const { signer, connect, signerFor } = useWallet();
  const queryClient = useQueryClient();
  const [request, setRequest] = useState<TxRequest | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "simulating" });
  const assembled = useRef<AssembledTransaction<unknown> | null>(null);
  const attempt = useRef(0);
  const activeSigner = useRef<Signer | null>(null);

  const simulate = useCallback(async (next: TxRequest, withSigner: Signer) => {
    const id = ++attempt.current;
    assembled.current = null;
    setPhase({ name: "simulating" });
    try {
      const tx = await next.build(withSigner);
      if (id !== attempt.current) return;
      if (tx.simulation && rpc.Api.isSimulationError(tx.simulation)) {
        setPhase({ name: "failed", error: parseError(tx.simulation.error), stage: "simulation" });
        return;
      }
      assembled.current = tx;
      setPhase({ name: "ready", fee: tx.built?.fee ?? "0" });
    } catch (error) {
      if (id === attempt.current) setPhase({ name: "failed", error: parseError(error), stage: "simulation" });
    }
  }, []);

  const run = useCallback(
    async <T,>(next: TxRequest<T>) => {
      let active = signer;
      if (!active) {
        const address = await connect();
        if (!address) return;
        active = signerFor(address);
      }
      setRequest(next as TxRequest);
      activeSigner.current = active;
      void simulate(next as TxRequest, active);
    },
    [signer, connect, signerFor, simulate],
  );

  const close = useCallback(() => {
    attempt.current++;
    setRequest(null);
  }, []);

  const confirm = useCallback(async () => {
    const tx = assembled.current;
    if (!tx || !request) return;
    setPhase({ name: "signing" });
    try {
      const sent = await tx.signAndSend({
        watcher: { onSubmitted: () => setPhase({ name: "sending" }) },
      });
      const hash = sent.sendTransactionResponse?.hash ?? "";
      let result: unknown;
      try {
        result = sent.result;
      } catch {
        result = undefined;
      }
      toast.success(request.successLabel, {
        description: hash ? "View the transaction on stellar.expert" : undefined,
        action: hash ? { label: "View", onClick: () => window.open(explorer.tx(hash), "_blank", "noopener") } : undefined,
      });
      if (request.treasuryId) {
        await queryClient.invalidateQueries({ queryKey: ["treasury", request.treasuryId] });
      }
      request.onSuccess?.({ hash, assembled: tx, result });
      close();
    } catch (error) {
      setPhase({ name: "failed", error: parseError(error), stage: "send" });
    }
  }, [request, queryClient, close]);

  const busy = phase.name === "signing" || phase.name === "sending";
  const value = useMemo(() => ({ run }), [run]);

  return (
    <Context.Provider value={value}>
      {children}
      <Dialog open={request !== null} onOpenChange={(open) => !open && !busy && close()}>
        {request && (
          <DialogContent title={request.title} data-testid="tx-dialog">
            {request.summary && <div className="grid gap-2 text-sm">{request.summary}</div>}

            <div className="rounded-md border border-border bg-raised/50 px-4 py-3 text-sm" aria-live="polite">
              {phase.name === "simulating" && (
                <p className="flex items-center gap-2 text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Simulating on testnet before anything is signed…
                </p>
              )}
              {phase.name === "ready" && (
                <dl className="grid gap-1.5">
                  <div className="flex items-center gap-2 text-ok">
                    <CheckCircle2 className="size-4" aria-hidden />
                    <span>Simulation passed. This transaction will succeed if sent now.</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1">
                    <dt className="text-muted">Maximum network fee</dt>
                    <dd className="font-mono tabular" data-testid="tx-fee">
                      {formatFee(phase.fee)}
                    </dd>
                  </div>
                </dl>
              )}
              {phase.name === "signing" && (
                <p className="flex items-center gap-2 text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Waiting for your wallet to sign…
                </p>
              )}
              {phase.name === "sending" && (
                <p className="flex items-center gap-2 text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sent. Waiting for the network to confirm…
                </p>
              )}
              {phase.name === "failed" && (
                <div className="flex gap-2 text-danger" data-testid="tx-error">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="grid gap-0.5">
                    <p className="font-medium">
                      {phase.stage === "simulation" ? "This transaction would fail" : "The transaction was not completed"}
                      {phase.error.code !== undefined && (
                        <span className="ml-1.5 font-mono text-xs opacity-80">
                          {phase.error.name} #{phase.error.code}
                        </span>
                      )}
                    </p>
                    <p className="text-foreground/90">{phase.error.message}</p>
                  </div>
                </div>
              )}
            </div>

            {phase.name === "failed" && phase.stage === "simulation" && (
              <Notice tone="idle">Nothing was signed or sent, and no fee was charged.</Notice>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={busy}>
                {phase.name === "failed" ? "Close" : "Cancel"}
              </Button>
              {phase.name === "failed" ? (
                <Button variant="secondary" onClick={() => { const retry = signer ?? activeSigner.current; if (retry) void simulate(request, retry); }}>
                  Try again
                </Button>
              ) : (
                <Button onClick={confirm} disabled={phase.name !== "ready"} loading={busy} data-testid="tx-confirm">
                  {request.confirmLabel}
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Context.Provider>
  );
}
