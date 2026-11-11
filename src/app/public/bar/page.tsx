import { Suspense } from "react";
import View from "./view";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted">Loading…</div>}>
      <View />
    </Suspense>
  );
}
