import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { round2, financeFromProject, STATUS_LABELS_AR } from "../utils/finance";

const router = Router();
router.use(authenticate);

// نظرة عامة مالية + جدول المشاريع المالي
router.get(
  "/overview",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { isArchived: false },
      include: {
        client: { select: { id: true, name: true } },
        payments: true,
        specialists: true,
        expenses: true,
      },
    });
    let totalValue = 0,
      totalClientPaid = 0,
      totalSpecialistDue = 0,
      totalSpecialistPaid = 0,
      totalExpenses = 0,
      totalNetProfit = 0,
      unsettled = 0;

    const rows = projects.map((p) => {
      const fin = financeFromProject(p);
      totalValue += fin.value;
      totalClientPaid += fin.clientPaid;
      totalSpecialistDue += fin.specialistRemaining;
      totalSpecialistPaid += fin.specialistPaid;
      totalExpenses += fin.expenses;
      totalNetProfit += fin.netProfit;
      if (fin.clientRemaining > 0 || fin.specialistRemaining > 0) unsettled++;
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        title: p.title,
        client: p.client,
        status: p.status,
        statusLabel: STATUS_LABELS_AR[p.status] || p.status,
        value: fin.value,
        clientPaid: fin.clientPaid,
        clientRemaining: fin.clientRemaining,
        specialistCost: fin.specialistCost,
        specialistPaid: fin.specialistPaid,
        specialistRemaining: fin.specialistRemaining,
        expectedProfit: fin.expectedProfit,
        netProfit: fin.netProfit,
      };
    });

    res.json({
      summary: {
        totalValue: round2(totalValue),
        totalClientPaid: round2(totalClientPaid),
        totalUncollected: round2(totalValue - totalClientPaid),
        totalSpecialistDue: round2(totalSpecialistDue),
        totalSpecialistPaid: round2(totalSpecialistPaid),
        totalExpenses: round2(totalExpenses),
        totalNetProfit: round2(totalNetProfit),
        unsettledCount: unsettled,
      },
      projects: rows,
    });
  })
);

// سجل العمليات المالية
router.get(
  "/payments",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const { type, projectId } = req.query as Record<string, string>;
    const where: any = {};
    if (type && type !== "all") where.type = type;
    if (projectId) where.projectId = Number(projectId);
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        project: { select: { projectNumber: true, title: true } },
        client: { select: { name: true } },
        specialist: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    res.json(payments);
  })
);

// تسجيل دفعة من العميل
router.post(
  "/payments/client",
  authorize("financial", "create"),
  asyncHandler(async (req, res) => {
    const { projectId, amount, date, method, note } = req.body || {};
    const amt = parseNumber(amount);
    if (!projectId || !amt || amt <= 0) return res.status(400).json({ message: "المشروع والمبلغ مطلوبان" });
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const payment = await prisma.payment.create({
      data: {
        type: "client_in",
        amount: amt,
        date: parseDate(date) || new Date(),
        method,
        note,
        projectId: project.id,
        clientId: project.clientId,
        createdById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "client_payment",
      entityType: "payment",
      entityId: payment.id,
      projectId: project.id,
      description: `تسجيل دفعة عميل ${amt} للمشروع ${project.projectNumber}`,
    });
    res.status(201).json(payment);
  })
);

// تسجيل دفعة لمختص
router.post(
  "/payments/specialist",
  authorize("financial", "create"),
  asyncHandler(async (req, res) => {
    const { projectId, specialistId, amount, date, method, note } = req.body || {};
    const amt = parseNumber(amount);
    if (!projectId || !specialistId || !amt || amt <= 0)
      return res.status(400).json({ message: "المشروع والمختص والمبلغ مطلوبة" });
    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const specialist = await prisma.specialist.findUnique({ where: { id: Number(specialistId) } });
    if (!specialist) return res.status(404).json({ message: "المختص غير موجود" });
    const payment = await prisma.payment.create({
      data: {
        type: "specialist_out",
        amount: amt,
        date: parseDate(date) || new Date(),
        method,
        note,
        projectId: project.id,
        specialistId: specialist.id,
        createdById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "specialist_payment",
      entityType: "payment",
      entityId: payment.id,
      projectId: project.id,
      description: `تسجيل دفعة ${amt} للمختص ${specialist.name} (${project.projectNumber})`,
    });
    res.status(201).json(payment);
  })
);

router.delete(
  "/payments/:id",
  authorize("financial", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ message: "الدفعة غير موجودة" });
    await prisma.payment.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_payment",
      entityType: "payment",
      entityId: id,
      projectId: payment.projectId || undefined,
      description: `حذف دفعة بقيمة ${payment.amount}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

// مستحقات العملاء
router.get(
  "/client-dues",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const clients = await prisma.client.findMany({
      include: {
        projects: { select: { value: true } },
        payments: { where: { type: "client_in" }, select: { amount: true, date: true } },
      },
    });
    const rows = clients
      .map((c) => {
        const value = c.projects.reduce((s, p) => s + p.value, 0);
        const paid = c.payments.reduce((s, p) => s + p.amount, 0);
        return {
          id: c.id,
          name: c.name,
          totalValue: round2(value),
          totalPaid: round2(paid),
          remaining: round2(value - paid),
          lastPayment: c.payments.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.date || null,
        };
      })
      .filter((c) => c.remaining > 0.001)
      .sort((a, b) => b.remaining - a.remaining);
    res.json(rows);
  })
);

// مستحقات المختصين
router.get(
  "/specialist-dues",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const specialists = await prisma.specialist.findMany({
      include: {
        projectLinks: { select: { cost: true } },
        payments: { where: { type: "specialist_out" }, select: { amount: true } },
      },
    });
    const rows = specialists
      .map((s) => {
        const cost = s.projectLinks.reduce((a, p) => a + p.cost, 0);
        const paid = s.payments.reduce((a, p) => a + p.amount, 0);
        return {
          id: s.id,
          name: s.name,
          totalCost: round2(cost),
          totalPaid: round2(paid),
          remaining: round2(cost - paid),
        };
      })
      .filter((s) => s.remaining > 0.001)
      .sort((a, b) => b.remaining - a.remaining);
    res.json(rows);
  })
);

// المصروفات التشغيلية
router.get(
  "/expenses",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
      include: { project: { select: { projectNumber: true, title: true } }, createdBy: { select: { name: true } } },
    });
    res.json(expenses);
  })
);

router.post(
  "/expenses",
  authorize("financial", "create"),
  asyncHandler(async (req, res) => {
    const { type, amount, date, note, projectId } = req.body || {};
    const amt = parseNumber(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: "المبلغ مطلوب" });
    const expense = await prisma.expense.create({
      data: {
        type,
        amount: amt,
        date: parseDate(date) || new Date(),
        note,
        projectId: projectId ? Number(projectId) : null,
        createdById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_expense",
      entityType: "expense",
      entityId: expense.id,
      projectId: expense.projectId || undefined,
      description: `إضافة مصروف ${amt}${type ? " - " + type : ""}`,
    });
    res.status(201).json(expense);
  })
);

router.delete(
  "/expenses/:id",
  authorize("financial", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ message: "المصروف غير موجود" });
    await prisma.expense.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_expense",
      entityType: "expense",
      entityId: id,
      description: `حذف مصروف ${expense.amount}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
