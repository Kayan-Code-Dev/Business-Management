import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { financeFromProject, isProjectLate, round2, STATUS_LABELS_AR, CLOSED_STATUSES } from "../utils/finance";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("dashboard", "view"),
  asyncHandler(async (req, res) => {
    const flags = req.user!.permissions.flags;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setMilliseconds(dayEnd.getMilliseconds() - 1);

    const where: any = {};
    let visibleProjectIds: number[] | null = null;
    if (flags.onlyAssignedProjects) {
      const links = await prisma.projectSpecialist.findMany({
        where: { specialistId: req.user!.specialistId || -1 },
        select: { projectId: true },
      });
      visibleProjectIds = links.map((l) => l.projectId);
      where.id = { in: visibleProjectIds.length ? visibleProjectIds : [-1] };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        payments: true,
        specialists: { include: { specialist: { select: { name: true } } } },
        expenses: true,
      },
    });

    let activeCount = 0,
      lateCount = 0,
      completedThisMonth = 0,
      revenues = 0,
      expenses = 0,
      netProfit = 0,
      clientRemaining = 0,
      uncollectedProjectsCount = 0;

    for (const p of projects) {
      const fin = financeFromProject(p);
      const late = isProjectLate(p.status, p.deliveryDate);
      if (!CLOSED_STATUSES.includes(p.status)) activeCount++;
      if (late) lateCount++;
      if (p.status === "completed" && p.completedAt && new Date(p.completedAt) >= monthStart) completedThisMonth++;
      revenues += fin.clientPaid;
      expenses += fin.specialistPaid + fin.expenses;
      netProfit += fin.netProfit;
      clientRemaining += fin.clientRemaining;
      if (fin.clientRemaining > 0.001) uncollectedProjectsCount++;
    }

    // مشاريع متأخرة (للتنبيه)
    const lateProjects = projects
      .filter((p) => isProjectLate(p.status, p.deliveryDate))
      .map((p) => ({
        id: p.id,
        projectNumber: p.projectNumber,
        title: p.title,
        client: p.client?.name,
        deliveryDate: p.deliveryDate,
        responsibleSpecialist:
          p.specialists.map((s) => s.specialist.name).filter(Boolean).join("، ") || "غير محدد",
        daysLate: p.deliveryDate ? Math.max(1, Math.ceil((now.getTime() - new Date(p.deliveryDate).getTime()) / 86400000)) : 0,
        status: p.status,
        statusLabel: STATUS_LABELS_AR[p.status] || p.status,
      }))
      .sort((a, b) => b.daysLate - a.daysLate);

    // المهام المستحقة اليوم (حسب التسليم الداخلي للمختص)
    const taskWhere: any = {
      internalDeliveryDate: { gte: dayStart, lte: dayEnd },
      status: { not: "completed" },
      project: { status: { notIn: CLOSED_STATUSES } },
    };
    if (visibleProjectIds) {
      taskWhere.projectId = { in: visibleProjectIds.length ? visibleProjectIds : [-1] };
    }
    if (flags.onlyAssignedProjects) {
      taskWhere.specialistId = req.user!.specialistId || -1;
    }
    const todayTasks = await prisma.projectSpecialist.findMany({
      where: taskWhere,
      orderBy: [{ internalDeliveryDate: "asc" }, { id: "asc" }],
      include: {
        specialist: { select: { id: true, name: true } },
        project: { select: { id: true, projectNumber: true, title: true } },
      },
      take: 30,
    });
    const taskStatusLabel = (status: string) =>
      status === "assigned"
        ? "بانتظار المختص"
        : status === "in_progress"
          ? "قيد التنفيذ"
          : status === "completed"
            ? "مكتمل"
            : status;

    // جدول مختصر بأحدث المشاريع
    const recentProjects = projects
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 8)
      .map((p) => {
        const fin = financeFromProject(p);
        return {
          id: p.id,
          projectNumber: p.projectNumber,
          title: p.title,
          client: p.client?.name,
          specialists: p.specialists.map((s) => s.specialist.name),
          status: p.status,
          statusLabel: STATUS_LABELS_AR[p.status] || p.status,
          isLate: isProjectLate(p.status, p.deliveryDate),
          progress: p.progress,
          value: fin.value,
          clientRemaining: fin.clientRemaining,
        };
      });

    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    });

    res.json({
      cards: {
        activeProjects: activeCount,
        lateProjects: lateCount,
        completedThisMonth,
        totalProjects: projects.length,
        ...(flags.viewProfits
          ? {
              revenues: round2(revenues),
              expenses: round2(expenses),
              netProfit: round2(netProfit),
              clientRemaining: round2(clientRemaining),
              uncollectedProjectsCount,
            }
          : {}),
      },
      todayTasks: todayTasks.map((t) => ({
        id: t.id,
        taskName: t.role?.trim() || "مهمة تنفيذ",
        specialist: t.specialist.name,
        projectId: t.projectId,
        projectNumber: t.project.projectNumber,
        projectTitle: t.project.title,
        deliveryDate: t.internalDeliveryDate,
        status: t.status,
        statusLabel: taskStatusLabel(t.status),
      })),
      lateProjects,
      recentProjects,
      activities: activities.map((a) => ({
        id: a.id,
        action: a.action,
        description: a.description,
        user: a.user?.name,
        createdAt: a.createdAt,
      })),
    });
  })
);

export default router;
