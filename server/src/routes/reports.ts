import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { resolveRange } from "../utils/dateRange";
import { financeFromProject, isProjectLate, round2, STATUS_LABELS_AR, CLOSED_STATUSES } from "../utils/finance";

const router = Router();
router.use(authenticate);

async function buildReport(query: Record<string, any>) {
  const { from, to, label } = resolveRange(query);

  const projects = await prisma.project.findMany({
    include: {
      client: { select: { id: true, name: true } },
      payments: true,
      specialists: { include: { specialist: { select: { id: true, name: true } } } },
      expenses: true,
    },
  });

  const inRange = (d: Date | null | undefined) => d && new Date(d) >= from && new Date(d) <= to;

  // تقارير المشاريع
  const byStatus: Record<string, number> = {};
  const byService: Record<string, number> = {};
  let total = 0,
    active = 0,
    completed = 0,
    late = 0,
    underReview = 0;

  // تقارير مالية
  let revenues = 0,
    specialistPaid = 0,
    expensesTotal = 0,
    netProfit = 0,
    totalValue = 0,
    totalClientPaid = 0,
    totalSpecialistCost = 0;
  const serviceProfit: Record<string, number> = {};

  // عمليات
  let totalDeliveryDays = 0,
    completedWithDates = 0,
    revisionsCount = 0;

  for (const p of projects) {
    const createdInRange = inRange(p.createdAt);
    if (createdInRange) {
      total++;
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      const svc = p.serviceType || "غير محدد";
      byService[svc] = (byService[svc] || 0) + 1;
      if (!CLOSED_STATUSES.includes(p.status)) active++;
      if (p.status === "completed") completed++;
      if (["first_delivery", "revisions", "final_delivery"].includes(p.status)) underReview++;
    }
    if (isProjectLate(p.status, p.deliveryDate)) late++;
    if (p.status === "revisions") revisionsCount++;

    const fin = financeFromProject(p);
    // مالية ضمن الفترة (حسب تواريخ الدفعات)
    for (const pay of p.payments) {
      if (!inRange(pay.date)) continue;
      if (pay.type === "client_in") revenues += pay.amount;
      if (pay.type === "specialist_out") specialistPaid += pay.amount;
    }
    for (const e of p.expenses) {
      if (inRange(e.date)) expensesTotal += e.amount;
    }
    // إجماليات عامة
    totalValue += fin.value;
    totalClientPaid += fin.clientPaid;
    totalSpecialistCost += fin.specialistCost;
    netProfit += fin.netProfit;
    const svc = p.serviceType || "غير محدد";
    serviceProfit[svc] = (serviceProfit[svc] || 0) + fin.expectedProfit;

    if (p.status === "completed" && p.completedAt) {
      const days = Math.max(0, (new Date(p.completedAt).getTime() - new Date(p.startDate).getTime()) / 86400000);
      totalDeliveryDays += days;
      completedWithDates++;
    }
  }

  // تقارير المختصين
  const specialists = await prisma.specialist.findMany({
    include: {
      projectLinks: { include: { project: { select: { status: true, deliveryDate: true } } } },
      payments: { where: { type: "specialist_out" }, select: { amount: true } },
    },
  });
  const specialistRows = specialists.map((s) => {
    const tasks = s.projectLinks.length;
    const done = s.projectLinks.filter((l) => l.project.status === "completed").length;
    const lateTasks = s.projectLinks.filter((l) => isProjectLate(l.project.status, l.project.deliveryDate)).length;
    const cost = s.projectLinks.reduce((a, l) => a + l.cost, 0);
    const paid = s.payments.reduce((a, p) => a + p.amount, 0);
    return {
      id: s.id,
      name: s.name,
      tasks,
      completed: done,
      lateTasks,
      commitmentRate: tasks ? Math.round((done / tasks) * 100) : 0,
      totalCost: round2(cost),
      totalPaid: round2(paid),
      due: round2(cost - paid),
    };
  });

  // تقارير العملاء
  const clients = await prisma.client.findMany({
    include: {
      projects: { select: { value: true } },
      payments: { where: { type: "client_in" }, select: { amount: true } },
    },
  });
  const clientRows = clients.map((c) => {
    const value = c.projects.reduce((s, p) => s + p.value, 0);
    const paid = c.payments.reduce((s, p) => s + p.amount, 0);
    return {
      id: c.id,
      name: c.name,
      projectsCount: c.projects.length,
      totalValue: round2(value),
      totalPaid: round2(paid),
      remaining: round2(value - paid),
    };
  });

  const topServices = Object.entries(serviceProfit)
    .map(([name, profit]) => ({ name, profit: round2(profit) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return {
    range: { from, to, label },
    projects: {
      total,
      active,
      completed,
      late,
      underReview,
      byStatus: Object.entries(byStatus).map(([k, v]) => ({ status: k, label: STATUS_LABELS_AR[k] || k, count: v })),
      byService: Object.entries(byService).map(([k, v]) => ({ service: k, count: v })),
    },
    financial: {
      revenues: round2(revenues),
      totalCollected: round2(totalClientPaid),
      totalUncollected: round2(totalValue - totalClientPaid),
      specialistPaid: round2(specialistPaid),
      specialistDue: round2(totalSpecialistCost),
      expenses: round2(expensesTotal),
      netProfit: round2(netProfit),
      avgProfitPerProject: projects.length ? round2(netProfit / projects.length) : 0,
      topServices,
    },
    specialists: specialistRows.sort((a, b) => b.tasks - a.tasks),
    clients: {
      topByDealing: [...clientRows].sort((a, b) => b.projectsCount - a.projectsCount).slice(0, 5),
      topByPayments: [...clientRows].sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 5),
      defaulters: clientRows.filter((c) => c.remaining > 0.001).sort((a, b) => b.remaining - a.remaining).slice(0, 10),
    },
    operations: {
      avgDeliveryDays: completedWithDates ? round2(totalDeliveryDays / completedWithDates) : 0,
      lateProjects: late,
      revisionsCount,
      completedProjects: completedWithDates,
    },
  };
}

router.get(
  "/",
  authorize("reports", "view"),
  asyncHandler(async (req, res) => {
    const report = await buildReport(req.query as Record<string, any>);
    res.json(report);
  })
);

// تصدير إلى Excel
router.get(
  "/export/excel",
  authorize("reports", "view"),
  asyncHandler(async (req, res) => {
    const report = await buildReport(req.query as Record<string, any>);
    const wb = new ExcelJS.Workbook();
    wb.creator = "نظام إدارة المشاريع";
    wb.views = [{ rightToLeft: true } as any];

    const headerStyle = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        cell.alignment = { horizontal: "right", vertical: "middle" };
      });
    };

    // ملخص
    const s1 = wb.addWorksheet("ملخص");
    s1.addRow(["تقرير النظام", report.range.label]);
    s1.addRow([]);
    s1.addRow(["مؤشر", "القيمة"]);
    headerStyle(s1.lastRow!);
    [
      ["إجمالي المشاريع", report.projects.total],
      ["المشاريع النشطة", report.projects.active],
      ["المشاريع المكتملة", report.projects.completed],
      ["المشاريع المتأخرة", report.projects.late],
      ["الإيرادات (الفترة)", report.financial.revenues],
      ["المحصّل (إجمالي)", report.financial.totalCollected],
      ["غير المحصّل", report.financial.totalUncollected],
      ["مدفوع للمختصين (الفترة)", report.financial.specialistPaid],
      ["المصروفات (الفترة)", report.financial.expenses],
      ["صافي الربح", report.financial.netProfit],
    ].forEach((r) => s1.addRow(r));
    s1.columns.forEach((c) => (c.width = 28));

    // المشاريع حسب الحالة
    const s2 = wb.addWorksheet("المشاريع حسب الحالة");
    s2.addRow(["الحالة", "العدد"]);
    headerStyle(s2.lastRow!);
    report.projects.byStatus.forEach((r) => s2.addRow([r.label, r.count]));
    s2.columns.forEach((c) => (c.width = 24));

    // المختصون
    const s3 = wb.addWorksheet("المختصون");
    s3.addRow(["المختص", "المهام", "المكتملة", "المتأخرة", "نسبة الالتزام%", "إجمالي التكلفة", "المدفوع", "المتبقي"]);
    headerStyle(s3.lastRow!);
    report.specialists.forEach((r) =>
      s3.addRow([r.name, r.tasks, r.completed, r.lateTasks, r.commitmentRate, r.totalCost, r.totalPaid, r.due])
    );
    s3.columns.forEach((c) => (c.width = 18));

    // العملاء المتعثرون
    const s4 = wb.addWorksheet("مستحقات العملاء");
    s4.addRow(["العميل", "عدد المشاريع", "إجمالي القيمة", "المدفوع", "المتبقي"]);
    headerStyle(s4.lastRow!);
    report.clients.defaulters.forEach((r) =>
      s4.addRow([r.name, r.projectsCount, r.totalValue, r.totalPaid, r.remaining])
    );
    s4.columns.forEach((c) => (c.width = 20));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="report-${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

export default router;
