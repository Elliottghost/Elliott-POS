import type { ReactNode } from "react";
import { AlertIcon, CheckIcon } from "@/components/icons";

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-danger/20 bg-danger/[0.06] text-danger",
    success: "border-success/20 bg-success/[0.07] text-success",
    info: "border-line bg-sand/60 text-ink/75",
  } as const;

  const Icon = tone === "success" ? CheckIcon : AlertIcon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${styles[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
