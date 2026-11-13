"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionFields } from "@/components/action-form";
import { ActionList } from "@/components/action-list";
import { PageHeader } from "@/components/app-shell";
import { useTx } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Notice, Panel } from "@/components/ui/misc";
import {
  ACTION_KINDS,
  MAX_ACTIONS,
  MAX_MEMO_BYTES,
  emptyDraft,
  encodeDraft,
  memoBytes,
  parsePrefill,
  validateDraft,
  type ActionDraft,
  type ActionKind,
} from "@/lib/actions";
import { rememberTx } from "@/lib/storage";
import { rolesOf, treasuryClient, useOverview } from "@/lib/treasury";
import { useTokens } from "@/lib/use-tokens";
import { useWallet } from "@/lib/wallet";

interface Item {
  key: number;
  draft: ActionDraft;
}

const GROUPS = [...new Set(ACTION_KINDS.map((kind) => kind.group))];

function Builder({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const tokens = useTokens(id);
  const overview = useOverview(id);
  const { address } = useWallet();
  const tx = useTx();

  const [items, setItems] = useState<Item[]>(() => {
    const prefill = parsePrefill(search.get("prefill"));
    return prefill ? [{ key: 0, draft: prefill }] : [];
  });
  const [nextKey, setNextKey] = useState(1);
  const [memo, setMemo] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => items.map((item) => validateDraft(item.draft, tokens)), [items, tokens]);
  const valid = items.length > 0 && errors.every((entry) => Object.keys(entry).length === 0);
  const memoSize = memoBytes(memo);
  const memoTooLong = memoSize > MAX_MEMO_BYTES;
  const encoded = useMemo(() => {
    if (!valid) return null;
    try {
      return items.map((item) => encodeDraft(item.draft, tokens));
    } catch {
      return null;
    }
  }, [items, tokens, valid]);
  const isProposer = rolesOf(overview.data?.members, address).proposer;

  const add = (kind: ActionKind) => {
    setItems((current) => [...current, { key: nextKey, draft: emptyDraft(kind, tokens[0]?.id) }]);
    setNextKey((key) => key + 1);
  };

  const submit = () => {
    setShowErrors(true);
    if (!encoded || memoTooLong) return;
    tx.run({
      title: "Create proposal",
      confirmLabel: "Create proposal",
      successLabel: "Proposal created",
      treasuryId: id,
      summary: (
        <>
          <p className="text-muted">
            {encoded.length} action{encoded.length === 1 ? "" : "s"} will be proposed. Nothing runs until approvers reach the
            threshold and the timelock ends.
          </p>
          <ActionList actions={encoded} tokens={tokens} />
        </>
      ),
      build: (signer) => treasuryClient(id, signer).propose({ proposer: signer.publicKey, actions: encoded, memo: memo.trim() }),
      onSuccess: ({ hash, result }) => {
        const outcome = result as { isOk?: () => boolean; unwrap?: () => bigint } | undefined;
        const proposalId = outcome?.isOk?.() ? outcome.unwrap?.() : undefined;
        if (proposalId !== undefined) {
          rememberTx(id, `propose:${proposalId}`, hash);
          router.push(`/t/${id}/proposals/${proposalId}`);
        } else {
          router.push(`/t/${id}/proposals`);
        }
      },
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_26rem] xl:items-start">
      <div className="grid gap-6">
        {address && overview.data && !isProposer && (
          <Notice tone="warn" title="This wallet cannot create proposals">
            Only proposers can. You can still draft here, but the simulation will fail when you sign.
          </Notice>
        )}

        {items.map((item, index) => (
          <Panel as="section" key={item.key} aria-label={`Action ${index + 1}`} data-testid={`action-${index}`}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-3 text-base font-semibold">
                <span className="font-mono text-sm tabular text-muted">{index + 1}</span>
                {ACTION_KINDS.find((kind) => kind.kind === item.draft.kind)?.label}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}>
                <Trash2 aria-hidden /> Remove
              </Button>
            </div>
            <div className="p-5">
              <ActionFields
                draft={item.draft}
                onChange={(draft) => setItems((current) => current.map((other) => (other.key === item.key ? { ...other, draft } : other)))}
                errors={showErrors ? (errors[index] ?? {}) : {}}
                tokens={tokens}
                idPrefix={`action-${item.key}`}
              />
            </div>
          </Panel>
        ))}

        <Panel className="grid gap-3 p-5">
          <Field
            label={items.length === 0 ? "Choose the first action" : "Add another action"}
            htmlFor="add-action"
            hint={`${items.length} of ${MAX_ACTIONS} actions. They run in order, and all succeed or all revert.`}
          >
            <Select
              id="add-action"
              value=""
              disabled={items.length >= MAX_ACTIONS}
              onChange={(event) => event.target.value && add(event.target.value as ActionKind)}
              data-testid="add-action"
            >
              <option value="">Choose an action…</option>
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {ACTION_KINDS.filter((kind) => kind.group === group).map((kind) => (
                    <option key={kind.kind} value={kind.kind}>
                      {kind.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </Panel>

        <Panel className="p-5">
          <Field
            label="Memo"
            htmlFor="memo"
            error={memoTooLong ? `The memo is ${memoSize} bytes. The limit is ${MAX_MEMO_BYTES}.` : undefined}
            hint={`Shown to approvers and stored on chain. ${memoSize} of ${MAX_MEMO_BYTES} bytes.`}
          >
            <Textarea id="memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="What is this proposal for?" rows={2} />
          </Field>
        </Panel>
      </div>

      <Panel as="aside" className="grid gap-4 p-5 xl:sticky xl:top-24" aria-label="Summary">
        <h2 className="text-base font-semibold">Summary</h2>
        {encoded ? (
          <ActionList actions={encoded} tokens={tokens} />
        ) : (
          <p className="text-sm text-muted">
            {items.length === 0 ? "Add an action to see what approvers will be asked to sign off." : "Complete the highlighted fields to see the summary."}
          </p>
        )}
        {showErrors && !valid && items.length > 0 && (
          <Notice tone="danger">Some fields need attention before this can be signed.</Notice>
        )}
        <Button onClick={submit} disabled={items.length === 0 || memoTooLong} data-testid="review-proposal">
          {address ? "Review and sign" : "Connect wallet to continue"}
        </Button>
        <p className="text-sm text-muted">The transaction is simulated first. You see the fee and any error before your wallet opens.</p>
      </Panel>
    </div>
  );
}

export default function NewProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div>
      <PageHeader title="New proposal" description="Bundle one to ten actions. Approvers see exactly what you see in the summary." />
      <Suspense>
        <Builder id={id} />
      </Suspense>
    </div>
  );
}
