import { prisma } from "../prisma";
import { round2 } from "./finance";

// إرجاع الخزنة الافتراضية (وإنشاؤها إن لم توجد)
export async function getDefaultTreasury() {
  let t = await prisma.treasury.findFirst({ where: { isDefault: true } });
  if (!t) t = await prisma.treasury.findFirst({ orderBy: { id: "asc" } });
  if (!t) {
    t = await prisma.treasury.create({
      data: { name: "الخزنة الرئيسية", type: "cash", isDefault: true, isActive: true },
    });
  }
  return t;
}

export async function resolveTreasuryId(treasuryId?: number | null): Promise<number> {
  if (treasuryId) {
    const t = await prisma.treasury.findUnique({ where: { id: treasuryId } });
    if (t) return t.id;
  }
  const def = await getDefaultTreasury();
  return def.id;
}

export interface TxInput {
  treasuryId: number;
  direction: "in" | "out";
  category: string;
  amount: number;
  date?: Date;
  description?: string;
  counterAccount?: string;
  projectId?: number | null;
  clientId?: number | null;
  specialistId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  expenseId?: number | null;
  transferGroup?: string | null;
  createdById?: number | null;
}

export async function recordTransaction(input: TxInput) {
  return prisma.transaction.create({
    data: {
      treasuryId: input.treasuryId,
      direction: input.direction,
      category: input.category,
      amount: round2(input.amount),
      date: input.date || new Date(),
      description: input.description,
      counterAccount: input.counterAccount,
      projectId: input.projectId ?? null,
      clientId: input.clientId ?? null,
      specialistId: input.specialistId ?? null,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      expenseId: input.expenseId ?? null,
      transferGroup: input.transferGroup ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

// حساب رصيد خزنة = الرصيد الافتتاحي + الوارد - الصادر
export async function treasuryBalance(treasuryId: number, openingBalance: number): Promise<number> {
  const txs = await prisma.transaction.findMany({ where: { treasuryId }, select: { direction: true, amount: true } });
  let bal = openingBalance;
  for (const t of txs) bal += t.direction === "in" ? t.amount : -t.amount;
  return round2(bal);
}

export const COUNTER_ACCOUNTS: Record<string, string> = {
  client_payment: "إيرادات العملاء",
  specialist_payment: "مستحقات المختصين",
  expense: "مصروفات تشغيلية",
  deposit: "إيداع رأس مال / تسوية",
  withdrawal: "سحب نقدي",
  transfer: "تحويل بين الخزائن",
  other: "أخرى",
};

export const CATEGORY_LABELS: Record<string, string> = {
  client_payment: "دفعة عميل",
  specialist_payment: "دفعة لمختص",
  expense: "مصروف",
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  other: "أخرى",
};
