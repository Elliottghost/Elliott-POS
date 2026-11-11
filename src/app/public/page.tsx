import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listBranches } from "@/services/branches";
import { getSettingsMap } from "@/services/settings";

export const metadata: Metadata = {
  title: "Vista Kigali — Bar, Restaurant & Accommodation",
  description:
    "Vista Kigali is a bar, restaurant and accommodation destination with two branches in Kigali: Kimironko and Rond-Point.",
};

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Restaurant",
    description: "Rwandan and international dishes prepared to order.",
    href: "/public/menu",
    cta: "View the menu",
  },
  {
    title: "Bar",
    description: "Cocktails, spirits, beers and soft drinks served all evening.",
    href: "/public/bar",
    cta: "See the bar list",
  },
  {
    title: "Accommodation",
    description: "Comfortable rooms for short stays and business travel.",
    href: "/public/accommodation",
    cta: "Explore rooms",
  },
  {
    title: "Events",
    description: "Private dinners, celebrations and corporate gatherings.",
    href: "/public/events",
    cta: "Plan an event",
  },
  {
    title: "Gallery",
    description: "A look at the spaces, plates and rooms.",
    href: "/public/gallery",
    cta: "Browse photos",
  },
  {
    title: "Contact",
    description: "Reach the team for reservations and enquiries.",
    href: "/public/contact",
    cta: "Get in touch",
  },
];

export default async function PublicHomePage() {
  const [branches, settings] = await Promise.all([
    listBranches(null, { includeInactive: false }),
    getSettingsMap(),
  ]);

  const businessName = settings["business.name"] ?? "Vista Kigali";
  const currency = settings["business.currency"] ?? "RWF";

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="font-display text-xl font-bold text-ember">{businessName}</span>
          <nav className="hidden items-center gap-4 md:flex">
            <a href="/public/menu" className="text-[12px] font-semibold text-ink hover:text-ember">
              Menu
            </a>
            <a href="/public/accommodation" className="text-[12px] font-semibold text-ink hover:text-ember">
              Stay
            </a>
            <a href="/public/events" className="text-[12px] font-semibold text-ink hover:text-ember">
              Events
            </a>
            <a href="/public/contact" className="text-[12px] font-semibold text-ink hover:text-ember">
              Contact
            </a>
          </nav>
          <ButtonLink href="/login" size="sm" variant="primary">
            Staff sign in
          </ButtonLink>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <Badge>Bar · Resto · Accommodation</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
            Two addresses in Kigali, one standard of hospitality.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Fresh food, a well-stocked bar and comfortable rooms at Kimironko and Rond-Point.
            Prices are shown in {currency}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/public/menu">View menu</ButtonLink>
            <ButtonLink href="/public/accommodation" variant="secondary">
              Book a room
            </ButtonLink>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Our branches
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {branches.length === 0 ? (
              <Card className="p-6 text-sm text-muted">Branch details are being updated.</Card>
            ) : (
              branches.map((branch) => (
                <Card key={branch.id} className="p-6">
                  <h3 className="font-display text-xl font-bold">{branch.name}</h3>
                  <p className="mt-2 text-[14px] text-muted">
                    {"address" in branch && branch.address
                      ? String(branch.address)
                      : "Kigali, Rwanda"}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <ButtonLink href={`/public/menu?branch=${branch.id}`} size="sm" variant="secondary">
                      Menu
                    </ButtonLink>
                    <ButtonLink
                      href={`/public/accommodation?branch=${branch.id}`}
                      size="sm"
                      variant="secondary"
                    >
                      Rooms
                    </ButtonLink>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Card key={section.title} className="p-6">
                <h3 className="font-display text-lg font-bold">{section.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{section.description}</p>
                <div className="mt-4">
                  <ButtonLink href={section.href} size="sm" variant="secondary">
                    {section.cta}
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {businessName}
          </span>
          <span>Kimironko · Rond-Point · Kigali, Rwanda</span>
        </div>
      </footer>
    </div>
  );
}
