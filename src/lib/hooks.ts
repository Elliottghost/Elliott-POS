"use client";

import { useEffect, useState } from "react";

/** Tracks whether the component has mounted on the client. */
export function useIsMounted(): [boolean] {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return [mounted];
}

/** Delays a rapidly changing value (search inputs, filters). */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
