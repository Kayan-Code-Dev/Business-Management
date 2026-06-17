import { ReactNode, useEffect } from "react";
import { STATUS_META } from "../lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function StatCard({
  title,
  value,
  icon,
  tone = "brand",
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "green" | "red" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card p-4 flex items-center gap-4">
      {icon && <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl ${tones[tone]}`}>{icon}</div>}
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-sm text-slate-500">{title}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status, isLate }: { status: string; isLate?: boolean }) {
  if (isLate) {
    const meta = STATUS_META.late;
    return <span className={`badge ${meta.color}`}>متأخر</span>;
  }
  const meta = STATUS_META[status] || { label: status, color: "bg-slate-100 text-slate-700" };
  return <span className={`badge ${meta.color}`}>{meta.label}</span>;
}

export function Badge({ children, color = "bg-slate-100 text-slate-700" }: { children: ReactNode; color?: string }) {
  return <span className={`badge ${color}`}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto no-print">
      <div className={`card w-full ${widths[size]} mt-12 mb-12`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-slate-400 text-sm">{message}</div>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 min-w-[80px]">
      <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
