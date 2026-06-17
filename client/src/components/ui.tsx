import { ReactNode, useEffect } from "react";
import { STATUS_META } from "../lib/format";
import { Icon, IconName } from "./Icon";

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="h-11 w-11 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-soft">
            <Icon name={icon} size={22} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={`card p-5 ${hover ? "card-hover" : ""} ${className}`}>{children}</div>;
}

const TONES: Record<string, { bg: string; text: string; ring: string }> = {
  brand: { bg: "bg-brand-50", text: "text-brand-600", ring: "ring-brand-100" },
  green: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
  red: { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
  slate: { bg: "bg-ink-100", text: "text-ink-600", ring: "ring-ink-200" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100" },
};

export function StatCard({
  title,
  value,
  icon,
  tone = "brand",
  hint,
}: {
  title: string;
  value: ReactNode;
  icon?: IconName;
  tone?: keyof typeof TONES;
  hint?: ReactNode;
}) {
  const t = TONES[tone] || TONES.brand;
  return (
    <div className="card card-hover p-5 flex items-start gap-4 animate-slide-up">
      {icon && (
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ring-4 ${t.bg} ${t.text} ${t.ring}`}>
          <Icon name={icon} size={22} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-ink-900 truncate">{value}</div>
        <div className="text-sm text-ink-500 mt-0.5">{title}</div>
        {hint && <div className="text-xs mt-1">{hint}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status, isLate }: { status: string; isLate?: boolean }) {
  const meta = isLate ? STATUS_META.late : STATUS_META[status] || { label: status, color: "bg-ink-100 text-ink-700", dot: "bg-ink-400" };
  return (
    <span className={`badge ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${(meta as any).dot || "bg-current"}`} />
      {isLate ? "متأخر" : meta.label}
    </span>
  );
}

export function Badge({ children, color = "bg-ink-100 text-ink-700" }: { children: ReactNode; color?: string }) {
  return <span className={`badge ${color}`}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  subtitle?: string;
}) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", handler);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 backdrop-blur-sm p-4 overflow-y-auto no-print animate-fade-in">
      <div className={`card w-full ${widths[size]} mt-10 mb-12 shadow-lift animate-scale-in`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h3 className="font-bold text-ink-900 text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required, hint }: { label: string; children: ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-9 flex-1 ${j === 0 ? "max-w-[120px]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, icon = "search", action }: { message: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="text-center py-14">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-ink-100 text-ink-400 flex items-center justify-center mb-3">
        <Icon name={icon} size={26} />
      </div>
      <p className="text-ink-500 text-sm">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "green" | "amber" | "red" }) {
  const colors = { brand: "bg-brand-gradient", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <div className="w-full bg-ink-100 rounded-full h-2 min-w-[80px] overflow-hidden">
      <div className={`${colors[tone]} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
