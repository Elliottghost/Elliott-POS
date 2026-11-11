"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-2">
      <Button variant="ember" size="sm" onClick={() => window.print()}>
        Print receipt
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.assign("/orders");
        }}
      >
        Back
      </Button>
    </div>
  );
}
