export const metadata = {
  title: "Vista Kigali - Bar, Restaurant & Accommodation",
  description:
    "Premier hospitality destination in Kigali - fine dining, drinks and accommodation.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-cream text-ink">{children}</div>;
}
