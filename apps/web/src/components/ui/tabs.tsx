"use client";

import { Tabs as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = Primitive.Root;
export const TabsContent = Primitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn("flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-foreground",
        "data-[state=active]:border-accent data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
