import type { ReactNode } from "react";

const tones = {
  neutral: "bg-sand text-ink/70 border-line",
  ember: "bg-ember-soft text-ember-strong border-ember/20",
  success: "bg-success/10 text-success border-success/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  dark: "bg-charcoal text-cream border-charcoal",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-muted"}`}
      />
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
