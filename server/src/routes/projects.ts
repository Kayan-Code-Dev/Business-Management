import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import {
  financeFromProject,
  isProjectLate,
  PROJECT_STATUSES,
  STATUS_LABELS_AR,
  CLOSED_STATUSES,
} from "../utils/finance";

const router = Router();
router.use(authenticate);

// بناء شرط حصر المختص على مشاريعه فقط
async function assignedProjectIds(specialistId: number | null): Promise<number[]> {
  if (!specialistId) return [];
  const links = await prisma.projectSpecialist.findMany({
    where: { specialistId },
    select: { projectId: true },
  });
  return links.map((l) => l.projectId);
}

// قائمة المشاريع
router.get(
  "/",
  authorize("projects", "view"),
  asyncHandler(async (req, res) => {
    const { search, status, serviceType, clientId, specialistId, archived } = req.query as Record<string, string>;
    const where: any = {};
    where.isArchived = archived === "true";

    if (status && status !== "all") {
      if (status === "late") {
        where.AND = [
          { status: { notIn: CLOSED_STATUSES } },
          { deliveryDate: { lt: new Date() } },
        ];
      } else {
        where.status = status;
      }
    }
    if (serviceType && serviceType !== "all") where.serviceType = serviceType;
    if (clientId) where.clientId = Number(clientId);
    if (specialistId) where.specialists = { some: { specialistId: Number(specialistId) } };
    if (search) {
      where.OR = [
        { projectNumber: { contains: search } },
        { title: { contains: search } },
        { client: { name: { contains: search } } },
        { specialists: { some: { specialist: { name: { contains: search } } } } },
      ];
    }

    // حصر المختص على مشاريعه
    const flags = req.user!.permissions.flags;
    if (flags.onlyAssignedProjects) {
      const ids = await assignedProjectIds(req.user!.specialistId);
      where.id = { in: ids.length ? ids : [-1] };
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        payments: true,
        specialists: { include: { specialist: { select: { id: true, name: true } } } },
        expenses: true,
      },
    });

    const canSeeProfits = flags.viewProfits;
    const canSeeSpecCost = flags.viewSpecialistCosts;
    const result = projects.map((p) => {
      const fin = financeFromProject(p);
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        title: p.title,
        serviceType: p.serviceType,
        status: p.status,
        statusLabel: STATUS_LABELS_AR[p.status] || p.status,
        isLate: isProjectLate(p.status, p.deliveryDate),
        progress: p.progress,
        deliveryDate: p.deliveryDate,
        startDate: p.startDate,
        client: p.client,
        specialists: p.specialists.map((s) => ({ id: s.specialist.id, name: s.specialist.name, role: s.role })),
        value: fin.value,
        clientPaid: fin.clientPaid,
        clientRemaining: fin.clientRemaining,
        ...(canSeeSpecCost ? { specialistCost: fin.specialistCost, specialistPaid: fin.specialistPaid, specialistRemaining: fin.specialistRemaining } : {}),
        ...(canSeeProfits ? { expectedProfit: fin.expectedProfit, netProfit: fin.netProfit } : {}),
      };
    });
    res.json(result);
  })
);

// تفاصيل مشروع
router.get(
  "/:id",
  authorize("projects", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const flags = req.user!.permissions.flags;
    if (flags.onlyAssignedProjects) {
      const ids = await assignedProjectIds(req.user!.specialistId);
      if (!ids.includes(id)) return res.status(403).json({ message: "ليس لديك صلاحية لعرض هذا المشروع" });
    }
    const p = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        payments: { orderBy: { date: "desc" }, include: { specialist: { select: { id: true, name: true } }, createdBy: { select: { name: true } } } },
        specialists: { include: { specialist: true } },
        files: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
        projectNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        expenses: { orderBy: { date: "desc" } },
      },
    });
    if (!p) return res.status(404).json({ message: "المشروع غير موجود" });
    const fin = financeFromProject(p);
    const canSeeProfits = flags.viewProfits;
    const canSeeSpecCost = flags.viewSpecialistCosts;

    res.json({
      id: p.id,
      projectNumber: p.projectNumber,
      title: p.title,
      serviceType: p.serviceType,
      status: p.status,
      statusLabel: STATUS_LABELS_AR[p.status] || p.status,
      isLate: isProjectLate(p.status, p.deliveryDate),
      progress: p.progress,
      value: p.value,
      deliveryDate: p.deliveryDate,
      startDate: p.startDate,
      completedAt: p.completedAt,
      isArchived: p.isArchived,
      notes: p.notes,
      client: p.client,
      specialists: p.specialists.map((s) => ({
        id: s.id,
        specialistId: s.specialistId,
        name: s.specialist.name,
        role: s.role,
        status: s.status,
        internalDeliveryDate: s.internalDeliveryDate,
        ...(canSeeSpecCost ? { cost: s.cost } : {}),
      })),
      files: p.files.map((f) => ({
        id: f.id,
        name: f.name,
        originalName: f.originalName,
        category: f.category,
        size: f.size,
        mimeType: f.mimeType,
        uploadedBy: f.uploadedBy?.name,
        createdAt: f.createdAt,
      })),
      notes_list: p.projectNotes.map((n) => ({
        id: n.id,
        text: n.text,
        type: n.type,
        author: n.author?.name,
        createdAt: n.createdAt,
      })),
      payments: p.payments
        .filter(() => flags.viewProfits || canSeeSpecCost || true)
        .map((pay) => ({
          id: pay.id,
          type: pay.type,
          amount: pay.amount,
          date: pay.date,
          method: pay.method,
          note: pay.note,
          specialist: pay.specialist,
          createdBy: pay.createdBy?.name,
        }))
        // المختص لا يرى الدفعات المالية
        .filter(() => req.user!.permissions.modules.financial.view || canSeeProfits || canSeeSpecCost),
      expenses: canSeeProfits ? p.expenses : [],
      finance: {
        value: fin.value,
        clientPaid: fin.clientPaid,
        clientRemaining: fin.clientRemaining,
        ...(canSeeSpecCost ? { specialistCost: fin.specialistCost, specialistPaid: fin.specialistPaid, specialistRemaining: fin.specialistRemaining } : {}),
        ...(canSeeProfits ? { expenses: fin.expenses, expectedProfit: fin.expectedProfit, netProfit: fin.netProfit } : {}),
      },
    });
  })
);

// إنشاء مشروع
router.post(
  "/",
  authorize("projects", "create"),
  asyncHandler(async (req, res) => {
    const { projectNumber, title, serviceType, clientId, value, deliveryDate, startDate, notes, progress } = req.body || {};
    if (!title || !clientId) return res.status(400).json({ message: "عنوان المشروع والعميل مطلوبان" });

    const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
    if (!client) return res.status(400).json({ message: "العميل غير موجود" });

    let number = projectNumber;
    if (!number) {
      const count = await prisma.project.count();
      number = `PRJ-${String(count + 1).padStart(4, "0")}`;
    } else {
      const dup = await prisma.project.findUnique({ where: { projectNumber: number } });
      if (dup) return res.status(400).json({ message: "رقم المشروع مستخدم مسبقاً" });
    }

    const project = await prisma.project.create({
      data: {
        projectNumber: number,
        title,
        serviceType,
        clientId: Number(clientId),
        value: parseNumber(value, 0)!,
        deliveryDate: parseDate(deliveryDate),
        startDate: parseDate(startDate) || new Date(),
        notes,
        progress: parseNumber(progress, 0)!,
        status: "new",
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_project",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      description: `إنشاء مشروع ${project.projectNumber} - ${project.title}`,
    });
    res.status(201).json(project);
  })
);

// تعديل مشروع
router.put(
  "/:id",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المشروع غير موجود" });

    const { title, serviceType, clientId, value, deliveryDate, startDate, notes, progress } = req.body || {};
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (serviceType !== undefined) data.serviceType = serviceType;
    if (clientId !== undefined) data.clientId = Number(clientId);
    if (value !== undefined) data.value = parseNumber(value, existing.value);
    if (deliveryDate !== undefined) data.deliveryDate = parseDate(deliveryDate) || null;
    if (startDate !== undefined) data.startDate = parseDate(startDate) || existing.startDate;
    if (notes !== undefined) data.notes = notes;
    if (progress !== undefined) data.progress = parseNumber(progress, existing.progress);

    const project = await prisma.project.update({ where: { id }, data });
    await logActivity({
      userId: req.user!.id,
      action: "update_project",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      description: `تعديل مشروع ${project.projectNumber}`,
    });
    res.json(project);
  })
);

// تغيير حالة المشروع
router.patch(
  "/:id/status",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status, progress } = req.body || {};
    if (!PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ message: "حالة غير صحيحة" });
    }
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المشروع غير موجود" });

    const data: any = { status };
    if (status === "completed") {
      data.completedAt = new Date();
      data.progress = 100;
    } else if (progress !== undefined) {
      data.progress = parseNumber(progress, existing.progress);
    }
    const project = await prisma.project.update({ where: { id }, data });
    await logActivity({
      userId: req.user!.id,
      action: "change_status",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      description: `تغيير حالة المشروع ${project.projectNumber} إلى ${STATUS_LABELS_AR[status] || status}`,
    });
    res.json(project);
  })
);

// أرشفة / إلغاء أرشفة
router.patch(
  "/:id/archive",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { archived } = req.body || {};
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المشروع غير موجود" });
    const project = await prisma.project.update({ where: { id }, data: { isArchived: !!archived } });
    await logActivity({
      userId: req.user!.id,
      action: archived ? "archive_project" : "unarchive_project",
      entityType: "project",
      entityId: id,
      projectId: id,
      description: `${archived ? "أرشفة" : "إلغاء أرشفة"} المشروع ${project.projectNumber}`,
    });
    res.json(project);
  })
);

// حذف مشروع - لمدير النظام فقط، ويُمنع إذا فيه دفعات أو ملفات
router.delete(
  "/:id",
  authorize("projects", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.project.findUnique({
      where: { id },
      include: { payments: true, files: true },
    });
    if (!existing) return res.status(404).json({ message: "المشروع غير موجود" });
    if (existing.payments.length > 0 || existing.files.length > 0) {
      return res.status(400).json({
        message: "لا يمكن حذف مشروع له دفعات أو ملفات. يُفضّل الأرشفة بدلاً من الحذف.",
      });
    }
    await prisma.project.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_project",
      entityType: "project",
      entityId: id,
      description: `حذف المشروع ${existing.projectNumber}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

// ربط مختص بالمشروع
router.post(
  "/:id/specialists",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { specialistId, role, cost, internalDeliveryDate } = req.body || {};
    if (!specialistId) return res.status(400).json({ message: "المختص مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const specialist = await prisma.specialist.findUnique({ where: { id: Number(specialistId) } });
    if (!specialist) return res.status(400).json({ message: "المختص غير موجود" });

    const existing = await prisma.projectSpecialist.findUnique({
      where: { projectId_specialistId: { projectId, specialistId: Number(specialistId) } },
    });
    if (existing) return res.status(400).json({ message: "المختص مرتبط بالمشروع مسبقاً" });

    const link = await prisma.projectSpecialist.create({
      data: {
        projectId,
        specialistId: Number(specialistId),
        role,
        cost: parseNumber(cost, 0)!,
        internalDeliveryDate: parseDate(internalDeliveryDate),
        status: "assigned",
      },
    });
    // ترقية الحالة تلقائياً عند تعيين أول مختص
    if (project.status === "new") {
      await prisma.project.update({ where: { id: projectId }, data: { status: "specialist_assigned" } });
    }
    await logActivity({
      userId: req.user!.id,
      action: "assign_specialist",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `تعيين المختص ${specialist.name} للمشروع ${project.projectNumber}`,
    });
    res.status(201).json(link);
  })
);

router.put(
  "/:id/specialists/:linkId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const linkId = Number(req.params.linkId);
    const { role, cost, internalDeliveryDate, status } = req.body || {};
    const link = await prisma.projectSpecialist.findUnique({ where: { id: linkId } });
    if (!link) return res.status(404).json({ message: "الربط غير موجود" });
    const updated = await prisma.projectSpecialist.update({
      where: { id: linkId },
      data: {
        role,
        cost: cost !== undefined ? parseNumber(cost, link.cost) : link.cost,
        internalDeliveryDate: internalDeliveryDate !== undefined ? parseDate(internalDeliveryDate) : link.internalDeliveryDate,
        status: status || link.status,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_specialist_link",
      entityType: "project",
      entityId: link.projectId,
      projectId: link.projectId,
      description: `تعديل ربط مختص في المشروع`,
    });
    res.json(updated);
  })
);

router.delete(
  "/:id/specialists/:linkId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const linkId = Number(req.params.linkId);
    const link = await prisma.projectSpecialist.findUnique({ where: { id: linkId } });
    if (!link) return res.status(404).json({ message: "الربط غير موجود" });
    await prisma.projectSpecialist.delete({ where: { id: linkId } });
    await logActivity({
      userId: req.user!.id,
      action: "remove_specialist",
      entityType: "project",
      entityId: link.projectId,
      projectId: link.projectId,
      description: `إزالة مختص من المشروع`,
    });
    res.json({ message: "تم الحذف" });
  })
);

// ملاحظات المشروع
router.post(
  "/:id/notes",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { text, type } = req.body || {};
    if (!text) return res.status(400).json({ message: "نص الملاحظة مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const note = await prisma.note.create({
      data: { projectId, text, type: type || "general", authorId: req.user!.id },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_note",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `إضافة ملاحظة للمشروع ${project.projectNumber}`,
    });
    res.status(201).json(note);
  })
);

router.delete(
  "/:id/notes/:noteId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const noteId = Number(req.params.noteId);
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) return res.status(404).json({ message: "الملاحظة غير موجودة" });
    await prisma.note.delete({ where: { id: noteId } });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
