import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Brand tone="light" />
        </div>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-ember-strong">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl">This page is not on the menu</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The record or page you followed does not exist, or it has moved. Head
          back to the dashboard and continue from there.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-lg bg-charcoal px-4 text-sm font-semibold text-cream hover:bg-ink"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
