import type { ComponentProps } from "react";

const base =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 transition focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${base} ${className}`.trim()} {...props} />;
}
