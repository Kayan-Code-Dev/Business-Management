import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { round2 } from "../utils/finance";
import { recordTransaction, getDefaultTreasury, CATEGORY_LABELS, COUNTER_ACCOUNTS } from "../utils/treasury";

const router = Router();
router.use(authenticate);

// خريطة أرصدة الخزائن عبر تجميع الحركات
async function balanceMap(): Promise<Record<number, number>> {
  const grouped = await prisma.transaction.groupBy({
    by: ["treasuryId", "direction"],
    _sum: { amount: true },
  });
  const map: Record<number, number> = {};
  for (const g of grouped) {
    const v = g._sum.amount || 0;
    map[g.treasuryId] = (map[g.treasuryId] || 0) + (g.direction === "in" ? v : -v);
  }
  return map;
}

// قائمة الخزائن مع الأرصدة
router.get(
  "/treasuries",
  authorize("accounting", "view"),
  asyncHandler(async (_req, res) => {
    const treasuries = await prisma.treasury.findMany({ orderBy: { id: "asc" } });
    const map = await balanceMap();
    res.json(
      treasuries.map((t) => ({
        ...t,
        balance: round2((t.openingBalance || 0) + (map[t.id] || 0)),
      }))
    );
  })
);

router.post(
  "/treasuries",
  authorize("accounting", "create"),
  asyncHandler(async (req, res) => {
    const { name, type, openingBalance, isDefault, notes } = req.body || {};
    if (!name) return res.status(400).json({ message: "اسم الخزنة مطلوب" });
    if (isDefault) await prisma.treasury.updateMany({ data: { isDefault: false } });
    const treasury = await prisma.treasury.create({
      data: { name, type: type || "cash", openingBalance: parseNumber(openingBalance, 0)!, isDefault: !!isDefault, notes },
    });
    await logActivity({ userId: req.user!.id, action: "create_treasury", entityType: "treasury", entityId: treasury.id, description: `إنشاء خزنة: ${name}` });
    res.status(201).json(treasury);
  })
);

router.put(
  "/treasuries/:id",
  authorize("accounting", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, type, openingBalance, isDefault, isActive, notes } = req.body || {};
    if (isDefault) await prisma.treasury.updateMany({ data: { isDefault: false } });
    const treasury = await prisma.treasury.update({
      where: { id },
      data: {
        name,
        type,
        openingBalance: openingBalance !== undefined ? parseNumber(openingBalance, 0) : undefined,
        isDefault: isDefault !== undefined ? !!isDefault : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
        notes,
      },
    });
    await logActivity({ userId: req.user!.id, action: "update_treasury", entityType: "treasury", entityId: id, description: `تعديل خزنة: ${treasury.name}` });
    res.json(treasury);
  })
);

router.delete(
  "/treasuries/:id",
  authorize("accounting", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const count = await prisma.transaction.count({ where: { treasuryId: id } });
    if (count > 0) return res.status(400).json({ message: "لا يمكن حذف خزنة بها حركات" });
    const t = await prisma.treasury.findUnique({ where: { id } });
    if (t?.isDefault) return res.status(400).json({ message: "لا يمكن حذف الخزنة الافتراضية" });
    await prisma.treasury.delete({ where: { id } });
    res.json({ message: "تم الحذف" });
  })
);

// ملخص محاسبي
router.get(
  "/summary",
  authorize("accounting", "view"),
  asyncHandler(async (_req, res) => {
    const treasuries = await prisma.treasury.findMany();
    const map = await balanceMap();
    const totalBalance = treasuries.reduce((s, t) => s + (t.openingBalance || 0) + (map[t.id] || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const txs = await prisma.transaction.findMany({ select: { direction: true, amount: true, date: true } });
    let totalIn = 0, totalOut = 0, monthIn = 0, monthOut = 0;
    for (const t of txs) {
      if (t.direction === "in") {
        totalIn += t.amount;
        if (new Date(t.date) >= monthStart) monthIn += t.amount;
      } else {
        totalOut += t.amount;
        if (new Date(t.date) >= monthStart) monthOut += t.amount;
      }
    }
    res.json({
      totalBalance: round2(totalBalance),
      totalIn: round2(totalIn),
      totalOut: round2(totalOut),
      monthIn: round2(monthIn),
      monthOut: round2(monthOut),
      treasuriesCount: treasuries.length,
      transactionsCount: txs.length,
    });
  })
);

// كشف المعاملات
router.get(
  "/transactions",
  authorize("accounting", "view"),
  asyncHandler(async (req, res) => {
    const { treasuryId, direction, category, from, to, search } = req.query as Record<string, string>;
    const where: any = {};
    if (treasuryId && treasuryId !== "all") where.treasuryId = Number(treasuryId);
    if (direction && direction !== "all") where.direction = direction;
    if (category && category !== "all") where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(`${to}T23:59:59`);
    }
    if (search) where.description = { contains: search };

    const txs = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { treasury: { select: { name: true } }, createdBy: { select: { name: true } } },
    });
    res.json(
      txs.map((t) => ({
        id: t.id,
        date: t.date,
        direction: t.direction,
        category: t.category,
        categoryLabel: CATEGORY_LABELS[t.category] || t.category,
        counterAccount: t.counterAccount,
        amount: t.amount,
        description: t.description,
        treasury: t.treasury?.name,
        treasuryId: t.treasuryId,
        createdBy: t.createdBy?.name,
        projectId: t.projectId,
      }))
    );
  })
);

// القيود المحاسبية (مزدوجة القيد)
router.get(
  "/journal",
  authorize("accounting", "view"),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(`${to}T23:59:59`);
    }
    const txs = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { treasury: { select: { name: true } } },
      take: 500,
    });
    const entries = txs.map((t) => {
      const treasuryAcc = t.treasury?.name || "الخزنة";
      const counter = t.counterAccount || COUNTER_ACCOUNTS[t.category] || "حساب";
      const lines =
        t.direction === "in"
          ? [
              { account: treasuryAcc, debit: t.amount, credit: 0 },
              { account: counter, debit: 0, credit: t.amount },
            ]
          : [
              { account: counter, debit: t.amount, credit: 0 },
              { account: treasuryAcc, debit: 0, credit: t.amount },
            ];
      return {
        id: t.id,
        date: t.date,
        reference: `JE-${String(t.id).padStart(5, "0")}`,
        description: t.description || CATEGORY_LABELS[t.category] || "",
        amount: t.amount,
        lines,
      };
    });
    res.json(entries);
  })
);

// عملية يدوية: إيداع / سحب / تحويل
router.post(
  "/operations",
  authorize("accounting", "create"),
  asyncHandler(async (req, res) => {
    const { type, treasuryId, toTreasuryId, amount, date, description } = req.body || {};
    const amt = parseNumber(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: "المبلغ مطلوب" });
    const opDate = parseDate(date) || new Date();
    const fromT = treasuryId ? await prisma.treasury.findUnique({ where: { id: Number(treasuryId) } }) : await getDefaultTreasury();
    if (!fromT) return res.status(400).json({ message: "الخزنة غير موجودة" });

    if (type === "deposit") {
      await recordTransaction({ treasuryId: fromT.id, direction: "in", category: "deposit", counterAccount: COUNTER_ACCOUNTS.deposit, amount: amt, date: opDate, description: description || "إيداع نقدي", createdById: req.user!.id });
    } else if (type === "withdrawal") {
      await recordTransaction({ treasuryId: fromT.id, direction: "out", category: "withdrawal", counterAccount: COUNTER_ACCOUNTS.withdrawal, amount: amt, date: opDate, description: description || "سحب نقدي", createdById: req.user!.id });
    } else if (type === "transfer") {
      const toT = await prisma.treasury.findUnique({ where: { id: Number(toTreasuryId) } });
      if (!toT) return res.status(400).json({ message: "خزنة الوجهة غير موجودة" });
      if (toT.id === fromT.id) return res.status(400).json({ message: "اختر خزنة وجهة مختلفة" });
      const group = crypto.randomBytes(8).toString("hex");
      await recordTransaction({ treasuryId: fromT.id, direction: "out", category: "transfer", counterAccount: `تحويل إلى ${toT.name}`, amount: amt, date: opDate, description: description || `تحويل إلى ${toT.name}`, transferGroup: group, createdById: req.user!.id });
      await recordTransaction({ treasuryId: toT.id, direction: "in", category: "transfer", counterAccount: `تحويل من ${fromT.name}`, amount: amt, date: opDate, description: description || `تحويل من ${fromT.name}`, transferGroup: group, createdById: req.user!.id });
    } else {
      return res.status(400).json({ message: "نوع عملية غير صحيح" });
    }
    await logActivity({ userId: req.user!.id, action: `treasury_${type}`, entityType: "treasury", entityId: fromT.id, description: `${type === "deposit" ? "إيداع" : type === "withdrawal" ? "سحب" : "تحويل"} بقيمة ${amt}` });
    res.status(201).json({ message: "تمت العملية" });
  })
);

// حذف حركة يدوية فقط
router.delete(
  "/transactions/:id",
  authorize("accounting", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return res.status(404).json({ message: "الحركة غير موجودة" });
    if (!["deposit", "withdrawal", "transfer", "other"].includes(tx.category)) {
      return res.status(400).json({ message: "هذه الحركة مرتبطة بدفعة/مصروف. احذفها من مكانها الأصلي." });
    }
    if (tx.transferGroup) {
      await prisma.transaction.deleteMany({ where: { transferGroup: tx.transferGroup } });
    } else {
      await prisma.transaction.delete({ where: { id } });
    }
    await logActivity({ userId: req.user!.id, action: "delete_transaction", entityType: "transaction", entityId: id, description: `حذف حركة خزنة بقيمة ${tx.amount}` });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
