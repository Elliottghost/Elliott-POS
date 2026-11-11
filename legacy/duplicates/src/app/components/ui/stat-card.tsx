import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "light",
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${
        dark
          ? "border-charcoal bg-charcoal text-cream shadow-[0_16px_40px_-28px_rgb(22_18_15_/0.9)]"
          : "border-line bg-white shadow-card"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
            dark ? "text-cream/40" : "text-muted"
          }`}
        >
          {label}
        </p>
        {icon ? (
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
              dark ? "bg-cream/[0.06] text-ember" : "bg-sand text-ink/50"
            }`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-3 break-words font-display text-[clamp(22px,6.5vw,30px)] leading-[1.05] tracking-tight ${
          dark ? "text-cream" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={`mt-2.5 text-[12px] leading-relaxed ${
            dark ? "text-cream/45" : "text-muted"
          }`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
