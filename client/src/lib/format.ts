let currencySymbol = "ر.س";

export function setCurrency(symbol: string) {
  if (symbol) currencySymbol = symbol;
}

export function money(value: number | undefined | null): string {
  const n = Number(value || 0);
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currencySymbol}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const STATUS_META: Record<string, { label: string; color: string; dot: string; accent: string }> = {
  new: { label: "جديد", color: "bg-ink-100 text-ink-600", dot: "bg-ink-400", accent: "border-ink-300" },
  specialist_assigned: { label: "بانتظار المختص", color: "bg-violet-50 text-violet-700", dot: "bg-violet-500", accent: "border-violet-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500", accent: "border-blue-400" },
  first_delivery: { label: "بانتظار العميل (تسليم أول)", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", accent: "border-amber-400" },
  revisions: { label: "بانتظار المختص (تعديلات)", color: "bg-violet-50 text-violet-700", dot: "bg-violet-500", accent: "border-violet-400" },
  final_delivery: { label: "بانتظار العميل (تسليم نهائي)", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500", accent: "border-amber-400" },
  completed: { label: "مكتمل", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", accent: "border-emerald-400" },
  cancelled: { label: "ملغي", color: "bg-ink-200 text-ink-600", dot: "bg-ink-400", accent: "border-ink-300" },
  late: { label: "متأخر", color: "bg-red-50 text-red-700", dot: "bg-red-500", accent: "border-red-400" },
};

export const PROJECT_STATUS_FLOW = [
  "new",
  "specialist_assigned",
  "in_progress",
  "first_delivery",
  "revisions",
  "final_delivery",
  "completed",
];

export function statusLabel(status: string): string {
  return STATUS_META[status]?.label || status;
}
