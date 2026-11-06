import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function FormSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  );
}
