"use client";

import { useEffect } from "react";

// Registered in production only — in dev it would sit in front of HMR.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  }, []);
  return null;
}
