// حسابات مالية وقواعد العمل

export const PROJECT_STATUSES = [
  "new",
  "specialist_assigned",
  "in_progress",
  "first_delivery",
  "revisions",
  "final_delivery",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS_AR: Record<string, string> = {
  new: "جديد",
  specialist_assigned: "تم تعيين مختص",
  in_progress: "قيد التنفيذ",
  first_delivery: "بانتظار العميل",
  revisions: "مراجعة",
  final_delivery: "بانتظار العميل",
  completed: "مكتمل",
  cancelled: "ملغي",
  late: "متأخر",
};

export const CLOSED_STATUSES = ["completed", "cancelled"];

export function isProjectLate(status: string, deliveryDate: Date | null | undefined): boolean {
  if (!deliveryDate) return false;
  if (CLOSED_STATUSES.includes(status)) return false;
  return new Date() > new Date(deliveryDate);
}

export interface ProjectFinance {
  value: number;
  clientPaid: number;
  clientRemaining: number;
  specialistCost: number;
  specialistPaid: number;
  specialistRemaining: number;
  expenses: number;
  expectedProfit: number;
  netProfit: number;
}

export function computeFinance(input: {
  value: number;
  clientPaid: number;
  specialistCost: number;
  specialistPaid: number;
  expenses: number;
}): ProjectFinance {
  const value = input.value || 0;
  const clientPaid = input.clientPaid || 0;
  const specialistCost = input.specialistCost || 0;
  const specialistPaid = input.specialistPaid || 0;
  const expenses = input.expenses || 0;
  return {
    value,
    clientPaid,
    clientRemaining: round2(value - clientPaid),
    specialistCost,
    specialistPaid,
    specialistRemaining: round2(specialistCost - specialistPaid),
    expenses,
    expectedProfit: round2(value - specialistCost - expenses),
    netProfit: round2(clientPaid - specialistPaid - expenses),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// حساب ماليات المشروع من سجلاته
export function financeFromProject(project: {
  value: number;
  payments?: { type: string; amount: number }[];
  specialists?: { cost: number }[];
  expenses?: { amount: number }[];
}): ProjectFinance {
  const clientPaid = (project.payments || [])
    .filter((p) => p.type === "client_in")
    .reduce((s, p) => s + p.amount, 0);
  const specialistPaid = (project.payments || [])
    .filter((p) => p.type === "specialist_out")
    .reduce((s, p) => s + p.amount, 0);
  const specialistCost = (project.specialists || []).reduce((s, p) => s + p.cost, 0);
  const expenses = (project.expenses || []).reduce((s, e) => s + e.amount, 0);
  return computeFinance({ value: project.value, clientPaid, specialistCost, specialistPaid, expenses });
}
