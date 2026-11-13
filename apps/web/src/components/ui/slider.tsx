"use client";

import { Slider as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Slider({ className, "aria-label": label, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root className={cn("relative flex h-6 w-full touch-none items-center select-none", className)} {...props}>
      <Primitive.Track className="relative h-1.5 grow rounded-full bg-raised">
        <Primitive.Range className="absolute h-full rounded-full bg-accent" />
      </Primitive.Track>
      <Primitive.Thumb
        aria-label={label}
        className="block size-5 rounded-full border-2 border-accent bg-surface shadow transition-transform hover:scale-110 focus-visible:outline-2"
      />
    </Primitive.Root>
  );
}
