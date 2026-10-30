import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Accessible dialog: Escape and backdrop click close it. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/70" aria-label="Close dialog" onClick={onClose} tabIndex={-1} />
      <div className="card relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none bg-ink-900 p-5 sm:rounded-b-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
