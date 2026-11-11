export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ember/40 bg-ember/15 font-display text-lg text-ember ${className}`}
      aria-hidden="true"
    >
      V
    </span>
  );
}

export function Brand({
  tone = "dark",
  compact = false,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const primary = tone === "dark" ? "text-cream" : "text-ink";
  const secondary = tone === "dark" ? "text-cream/50" : "text-muted";

  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="min-w-0">
        <p
          className={`font-display text-[17px] leading-tight tracking-tight ${primary}`}
        >
          Vista Kigali
        </p>
        {!compact ? (
          <p className={`text-[10px] uppercase tracking-[0.22em] ${secondary}`}>
            Bar · Resto · Accommodation
          </p>
        ) : null}
      </div>
    </div>
  );
}
