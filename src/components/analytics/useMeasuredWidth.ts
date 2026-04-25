"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useMeasuredWidth<T extends HTMLElement = HTMLDivElement>(fallback = 520) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number>(fallback);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const pad = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
      const w = el.clientWidth - pad;
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
