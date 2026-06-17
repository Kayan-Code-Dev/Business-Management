import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";
import { round2, STATUS_LABELS_AR, isProjectLate } from "../utils/finance";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("specialists", "view"),
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || "";
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { specialization: { contains: search } },
      ];
    }
    const specialists = await prisma.specialist.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        projectLinks: { select: { id: true, cost: true } },
        payments: { where: { type: "specialist_out" }, select: { amount: true } },
      },
    });
    const result = specialists.map((s) => {
      const totalCost = s.projectLinks.reduce((a, p) => a + p.cost, 0);
      const totalPaid = s.payments.reduce((a, p) => a + p.amount, 0);
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        specialization: s.specialization,
        skills: s.skills,
        experienceLevel: s.experienceLevel,
        status: s.status,
        paymentMethod: s.paymentMethod,
        notes: s.notes,
        tasksCount: s.projectLinks.length,
        totalCost: round2(totalCost),
        totalPaid: round2(totalPaid),
        totalDue: round2(totalCost - totalPaid),
        createdAt: s.createdAt,
      };
    });
    res.json(result);
  })
);

router.get(
  "/:id",
  authorize("specialists", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const specialist = await prisma.specialist.findUnique({
      where: { id },
      include: {
        projectLinks: {
          include: { project: { select: { id: true, projectNumber: true, title: true, status: true, deliveryDate: true } } },
        },
        payments: { where: { type: "specialist_out" }, orderBy: { date: "desc" } },
      },
    });
    if (!specialist) return res.status(404).json({ message: "المختص غير موجود" });
    const totalCost = specialist.projectLinks.reduce((a, p) => a + p.cost, 0);
    const totalPaid = specialist.payments.reduce((a, p) => a + p.amount, 0);
    const tasks = specialist.projectLinks.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      projectNumber: l.project.projectNumber,
      projectTitle: l.project.title,
      role: l.role,
      cost: l.cost,
      internalDeliveryDate: l.internalDeliveryDate,
      status: l.status,
      projectStatus: l.project.status,
      projectStatusLabel: STATUS_LABELS_AR[l.project.status] || l.project.status,
      isLate: isProjectLate(l.project.status, l.project.deliveryDate),
    }));
    const completedTasks = specialist.projectLinks.filter((l) => l.project.status === "completed").length;
    res.json({
      id: specialist.id,
      name: specialist.name,
      phone: specialist.phone,
      email: specialist.email,
      specialization: specialist.specialization,
      skills: specialist.skills,
      experienceLevel: specialist.experienceLevel,
      status: specialist.status,
      paymentMethod: specialist.paymentMethod,
      notes: specialist.notes,
      summary: {
        tasksCount: specialist.projectLinks.length,
        completedTasks,
        commitmentRate: specialist.projectLinks.length
          ? Math.round((completedTasks / specialist.projectLinks.length) * 100)
          : 0,
        totalCost: round2(totalCost),
        totalPaid: round2(totalPaid),
        totalDue: round2(totalCost - totalPaid),
      },
      tasks,
      payments: specialist.payments,
    });
  })
);

router.post(
  "/",
  authorize("specialists", "create"),
  asyncHandler(async (req, res) => {
    const { name, phone, email, specialization, skills, experienceLevel, status, paymentMethod, notes } = req.body || {};
    if (!name) return res.status(400).json({ message: "اسم المختص مطلوب" });
    const specialist = await prisma.specialist.create({
      data: { name, phone, email, specialization, skills, experienceLevel, status: status || "active", paymentMethod, notes },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_specialist",
      entityType: "specialist",
      entityId: specialist.id,
      description: `إضافة مختص: ${specialist.name}`,
    });
    res.status(201).json(specialist);
  })
);

router.put(
  "/:id",
  authorize("specialists", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, phone, email, specialization, skills, experienceLevel, status, paymentMethod, notes } = req.body || {};
    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المختص غير موجود" });
    const specialist = await prisma.specialist.update({
      where: { id },
      data: { name, phone, email, specialization, skills, experienceLevel, status, paymentMethod, notes },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_specialist",
      entityType: "specialist",
      entityId: specialist.id,
      description: `تعديل مختص: ${specialist.name}`,
    });
    res.json(specialist);
  })
);

router.delete(
  "/:id",
  authorize("specialists", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const links = await prisma.projectSpecialist.count({ where: { specialistId: id } });
    if (links > 0) {
      return res.status(400).json({ message: "لا يمكن حذف مختص مرتبط بمشاريع" });
    }
    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المختص غير موجود" });
    await prisma.payment.deleteMany({ where: { specialistId: id } });
    await prisma.specialist.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_specialist",
      entityType: "specialist",
      entityId: id,
      description: `حذف مختص: ${existing.name}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
