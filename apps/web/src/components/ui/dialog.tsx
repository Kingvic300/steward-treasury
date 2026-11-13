"use client";

import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & { title: string; description?: string }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
      <Primitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl border border-border-strong bg-surface p-6",
          "data-[state=open]:animate-in",
          className,
        )}
        {...props}
      >
        <div className="grid gap-1.5 pr-8">
          <Primitive.Title className="text-lg font-semibold">{title}</Primitive.Title>
          {description ? (
            <Primitive.Description className="text-sm text-muted">{description}</Primitive.Description>
          ) : (
            <Primitive.Description className="sr-only">{title}</Primitive.Description>
          )}
        </div>
        {children}
        <Primitive.Close
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted hover:bg-raised hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
