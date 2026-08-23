"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastLevel = "" | "ok" | "warn" | "error";
type ToastFn = (msg: string, type?: ToastLevel) => void;

const ToastContext = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<{ msg: string; type: ToastLevel } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<ToastFn>((msg, type = "") => {
    setCurrent({ msg, type });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), 2600);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="toast" className={`toast ${current ? current.type : "hidden"}`}>
        {current?.msg}
      </div>
    </ToastContext.Provider>
  );
}
