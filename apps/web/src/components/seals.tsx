import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Steward's signature mark: one seal per approver. Filled seals are approvals,
 * crossed seals are rejections, and the notch marks the threshold, so "2 of 3"
 * is something you can see, not just read.
 */
export function Seals({
  total,
  threshold,
  approvals,
  rejections = 0,
  size = "md",
  className,
}: {
  total: number;
  threshold: number;
  approvals: number;
  rejections?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimension = { sm: "size-3.5", md: "size-5", lg: "size-8" }[size];
  const icon = { sm: "size-2", md: "size-3", lg: "size-4" }[size];
  const gap = { sm: "gap-1", md: "gap-1.5", lg: "gap-2.5" }[size];
  const count = Math.max(total, threshold, approvals + rejections);

  return (
    <span
      role="img"
      aria-label={`${approvals} of ${threshold} approvals needed${rejections ? `, ${rejections} rejected` : ""}, ${total} approvers`}
      className={cn("inline-flex items-center", gap, className)}
    >
      {Array.from({ length: count }, (_, index) => {
        const approved = index < approvals;
        const rejected = !approved && index >= count - rejections;
        return (
          <span key={index} className={cn("inline-flex items-center", gap)}>
            <span
              className={cn(
                "grid place-items-center rounded-full border transition-colors",
                dimension,
                approved && "border-accent bg-accent text-on-accent",
                rejected && "border-danger/60 bg-danger-soft text-danger",
                !approved && !rejected && "border-border-strong bg-transparent",
              )}
            >
              {approved && <Check className={icon} strokeWidth={3} aria-hidden />}
              {rejected && <X className={icon} strokeWidth={3} aria-hidden />}
            </span>
            {index === threshold - 1 && index < count - 1 && (
              <span aria-hidden className={cn("w-px bg-border-strong", size === "lg" ? "h-8" : size === "md" ? "h-5" : "h-3.5")} />
            )}
          </span>
        );
      })}
    </span>
  );
}
