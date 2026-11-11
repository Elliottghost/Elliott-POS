import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-charcoal px-12 py-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 90% at 100% 0%, rgba(217,119,66,0.22) 0%, rgba(26,22,19,0) 55%), radial-gradient(80% 60% at 0% 100%, rgba(217,119,66,0.12) 0%, rgba(26,22,19,0) 60%)",
          }}
        />
        <div className="pointer-events-none absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full border border-cream/10" />
        <div className="pointer-events-none absolute -right-16 top-1/3 h-[20rem] w-[20rem] rounded-full border border-ember/20" />

        <div className="relative">
          <Brand />
        </div>

        <div className="relative max-w-md">
          <p className="eyebrow text-cream/40">Kigali, Rwanda</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.15] text-cream">
            Two houses, one standard of hospitality.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-cream/60">
            Kimironko · Ku Isangano and Rond-Point · Kuri Azam run on a single
            operating platform — staff, access and branch performance in one
            place.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: "Branch 01", value: "Kimironko" },
              { label: "Branch 02", value: "Rond-Point" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-cream/10 bg-cream/[0.03] px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/35">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-cream/85">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] uppercase tracking-[0.2em] text-cream/25">
          Staff access only
        </p>
      </aside>

      <main className="flex min-h-svh flex-col bg-cream">
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <Brand tone="light" />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-14 pt-4 sm:px-8 lg:px-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
        <p className="px-6 pb-6 text-center text-[11px] text-muted">
          © {new Date().getFullYear()} Vista Kigali. Authorised staff only.
          Activity is logged.
        </p>
      </main>
    </div>
  );
}
