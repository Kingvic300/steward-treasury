"use client";

import { Tooltip as Primitive } from "radix-ui";

export const TooltipProvider = Primitive.Provider;

export function Tooltip({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-border-strong bg-raised px-2.5 py-1.5 text-xs text-foreground"
        >
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
