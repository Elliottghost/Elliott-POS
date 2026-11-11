import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Access denied" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { permission } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-charcoal px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-cream/10 bg-charcoal-soft p-7 shadow-2xl">
        <Brand />
        <p className="mt-7 text-[10px] uppercase tracking-[0.22em] text-ember">
          Access denied
        </p>
        <h1 className="mt-2 font-display text-3xl text-cream">
          This area is outside your role
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-cream/55">
          Your account ({user.roleLabel}) does not include permission to view
          this section. If you believe this is a mistake, ask a super
          administrator to review your role.
        </p>
        {permission ? (
          <p className="mt-4 rounded-lg border border-cream/10 bg-cream/[0.04] px-3 py-2 font-mono text-[11px] text-cream/45">
            required: {permission}
          </p>
        ) : null}
        <div className="mt-6 flex gap-2">
          <ButtonLink href="/dashboard" variant="ember">
            Back to dashboard
          </ButtonLink>
          <ButtonLink
            href="/account"
            variant="secondary"
            className="border-cream/15 bg-transparent text-cream/80 hover:bg-cream/10 hover:text-cream"
          >
            My account
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
