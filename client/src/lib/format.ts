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

export const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "bg-slate-100 text-slate-700" },
  specialist_assigned: { label: "تم تعيين المختص", color: "bg-indigo-100 text-indigo-700" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-700" },
  first_delivery: { label: "التسليم الأول", color: "bg-cyan-100 text-cyan-700" },
  revisions: { label: "تعديلات", color: "bg-amber-100 text-amber-700" },
  final_delivery: { label: "التسليم النهائي", color: "bg-teal-100 text-teal-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-slate-200 text-slate-600" },
  late: { label: "متأخر", color: "bg-red-100 text-red-700" },
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
