import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap";

const variants = {
  primary:
    "bg-charcoal text-cream hover:bg-ink shadow-[0_1px_0_rgb(255_255_255_/0.08)_inset]",
  ember: "bg-ember text-white hover:bg-ember-strong",
  secondary:
    "border border-line bg-white text-ink hover:border-charcoal/25 hover:bg-sand/60",
  ghost: "text-ink/70 hover:bg-sand/70 hover:text-ink",
  danger: "border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10",
} as const;

const sizes = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4",
  lg: "h-11 px-5",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
