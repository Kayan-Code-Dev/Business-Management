import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { financeFromProject, round2, STATUS_LABELS_AR, isProjectLate } from "../utils/finance";

const router = Router();
router.use(authenticate);

// قائمة العملاء مع ملخص مالي
router.get(
  "/",
  authorize("clients", "view"),
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || "";
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { specialization: { contains: search } },
      ];
    }
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        projects: { select: { id: true, value: true } },
        payments: { where: { type: "client_in" }, select: { amount: true } },
      },
    });
    const result = clients.map((c) => {
      const totalValue = c.projects.reduce((s, p) => s + p.value, 0);
      const totalPaid = c.payments.reduce((s, p) => s + p.amount, 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        country: c.country,
        specialization: c.specialization,
        notes: c.notes,
        projectsCount: c.projects.length,
        totalPaid: round2(totalPaid),
        totalRemaining: round2(totalValue - totalPaid),
        createdAt: c.createdAt,
      };
    });
    res.json(result);
  })
);

// ملف العميل التفصيلي
router.get(
  "/:id",
  authorize("clients", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            payments: true,
            specialists: true,
            expenses: true,
          },
          orderBy: { createdAt: "desc" },
        },
        payments: { orderBy: { date: "desc" }, include: { project: { select: { projectNumber: true, title: true } } } },
      },
    });
    if (!client) return res.status(404).json({ message: "العميل غير موجود" });

    const canSeeProfits = req.user!.permissions.flags.viewProfits;
    const projects = client.projects.map((p) => {
      const fin = financeFromProject(p);
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        title: p.title,
        serviceType: p.serviceType,
        status: p.status,
        statusLabel: STATUS_LABELS_AR[p.status] || p.status,
        isLate: isProjectLate(p.status, p.deliveryDate),
        deliveryDate: p.deliveryDate,
        value: fin.value,
        clientPaid: fin.clientPaid,
        clientRemaining: fin.clientRemaining,
        ...(canSeeProfits ? { netProfit: fin.netProfit } : {}),
      };
    });
    const totalPaid = client.payments.filter((p) => p.type === "client_in").reduce((s, p) => s + p.amount, 0);
    const totalValue = client.projects.reduce((s, p) => s + p.value, 0);
    res.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      country: client.country,
      specialization: client.specialization,
      notes: client.notes,
      createdAt: client.createdAt,
      summary: {
        projectsCount: client.projects.length,
        totalValue: round2(totalValue),
        totalPaid: round2(totalPaid),
        totalRemaining: round2(totalValue - totalPaid),
        lastPaymentDate: client.payments.find((p) => p.type === "client_in")?.date || null,
      },
      projects,
      payments: client.payments
        .filter((p) => p.type === "client_in")
        .map((p) => ({
          id: p.id,
          amount: p.amount,
          date: p.date,
          method: p.method,
          note: p.note,
          project: p.project,
        })),
    });
  })
);

router.post(
  "/",
  authorize("clients", "create"),
  asyncHandler(async (req, res) => {
    const { name, phone, country, specialization, notes } = req.body || {};
    if (!name) return res.status(400).json({ message: "اسم العميل مطلوب" });
    const client = await prisma.client.create({
      data: { name, phone, country, specialization, notes },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_client",
      entityType: "client",
      entityId: client.id,
      description: `إضافة عميل: ${client.name}`,
    });
    res.status(201).json(client);
  })
);

router.put(
  "/:id",
  authorize("clients", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, phone, country, specialization, notes } = req.body || {};
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "العميل غير موجود" });
    const client = await prisma.client.update({
      where: { id },
      data: { name, phone, country, specialization, notes },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_client",
      entityType: "client",
      entityId: client.id,
      description: `تعديل عميل: ${client.name}`,
    });
    res.json(client);
  })
);

router.delete(
  "/:id",
  authorize("clients", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const projectsCount = await prisma.project.count({ where: { clientId: id } });
    if (projectsCount > 0) {
      return res.status(400).json({ message: "لا يمكن حذف عميل مرتبط بمشاريع" });
    }
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "العميل غير موجود" });
    await prisma.payment.deleteMany({ where: { clientId: id } });
    await prisma.client.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_client",
      entityType: "client",
      entityId: id,
      description: `حذف عميل: ${existing.name}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
