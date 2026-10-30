"use client";
import { createContext, useCallback, useContext, useState } from "react";

type T = { id: number; text: string; action?: { label: string; run: () => void } };
const Ctx = createContext<(text: string, action?: T["action"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Inverted, square, bottom inline-end, gone after 4 seconds. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, action?: T["action"]) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, action }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className="toast"><span>{t.text}</span>{t.action ? <button type="button" onClick={() => { t.action!.run(); setItems((x) => x.filter((i) => i.id !== t.id)); }}>{t.action.label}</button> : null}</div>)}
      </div>
    </Ctx.Provider>
  );
}
