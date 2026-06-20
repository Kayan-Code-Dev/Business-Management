import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { env } from "../env";
import {
  financeFromProject,
  isProjectLate,
  PROJECT_STATUSES,
  STATUS_LABELS_AR,
  CLOSED_STATUSES,
} from "../utils/finance";

const router = Router();
router.use(authenticate);

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}
const deliveryStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const uploadDelivery = multer({ storage: deliveryStorage, limits: { fileSize: 25 * 1024 * 1024 } });

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
        _count: { select: { projectNotes: { where: { status: { not: "closed" } } }, files: true, tasks: true } },
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
        priority: p.priority,
        clientSource: p.clientSource,
        description: p.description,
        status: p.status,
        statusLabel: STATUS_LABELS_AR[p.status] || p.status,
        isLate: isProjectLate(p.status, p.deliveryDate),
        progress: p.progress,
        deliveryDate: p.deliveryDate,
        startDate: p.startDate,
        createdAt: p.createdAt,
        client: p.client,
        specialists: p.specialists.map((s) => ({ id: s.specialist.id, name: s.specialist.name, role: s.role })),
        notesCount: p._count.projectNotes,
        filesCount: p._count.files,
        tasksCount: p._count.tasks,
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
        projectNotes: {
          orderBy: [{ noteNumber: "desc" }, { createdAt: "desc" }],
          include: { author: { select: { name: true } }, assigneeSpecialist: { select: { id: true, name: true } } },
        },
        tasks: {
          orderBy: [{ deliveryDate: "asc" }, { id: "asc" }],
          include: { specialist: { select: { id: true, name: true } }, createdBy: { select: { name: true } } },
        },
        deliveries: {
          orderBy: { deliveredAt: "desc" },
          include: { specialist: { select: { id: true, name: true } }, uploadedBy: { select: { name: true } } },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, role: { select: { nameAr: true } } } } },
        },
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
      priority: p.priority,
      clientSource: p.clientSource,
      description: p.description,
      status: p.status,
      statusLabel: STATUS_LABELS_AR[p.status] || p.status,
      isLate: isProjectLate(p.status, p.deliveryDate),
      progress: p.progress,
      value: p.value,
      deliveryDate: p.deliveryDate,
      startDate: p.startDate,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      isArchived: p.isArchived,
      publicToken: p.publicToken,
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
        noteNumber: n.noteNumber,
        text: n.text,
        type: n.type,
        status: n.status,
        assignee: n.assigneeSpecialist ? { id: n.assigneeSpecialist.id, name: n.assigneeSpecialist.name } : null,
        author: n.author?.name,
        closedAt: n.closedAt,
        createdAt: n.createdAt,
      })),
      tasks: p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        progress: t.progress,
        deliveryDate: t.deliveryDate,
        specialist: t.specialist ? { id: t.specialist.id, name: t.specialist.name } : null,
        createdBy: t.createdBy?.name,
        createdAt: t.createdAt,
      })),
      deliveries: p.deliveries.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        originalName: d.originalName,
        note: d.note,
        deliveredAt: d.deliveredAt,
        specialist: d.specialist ? { id: d.specialist.id, name: d.specialist.name } : null,
        uploadedBy: d.uploadedBy?.name,
      })),
      messages: p.messages.map((m) => ({
        id: m.id,
        body: m.body,
        author: m.author?.name || "النظام",
        authorRole: m.author?.role?.nameAr || "",
        createdAt: m.createdAt,
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
      timeline: (
        await prisma.activityLog.findMany({
          where: { projectId: p.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { name: true } } },
        })
      ).map((a) => ({
        id: a.id,
        action: a.action,
        description: a.description,
        user: a.user?.name || "النظام",
        createdAt: a.createdAt,
      })),
    });
  })
);

// إنشاء مشروع
router.post(
  "/",
  authorize("projects", "create"),
  asyncHandler(async (req, res) => {
    const { projectNumber, title, serviceType, priority, clientSource, description, clientId, value, deliveryDate, startDate, notes, progress } = req.body || {};
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
        priority: priority || "medium",
        clientSource: clientSource || null,
        description,
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

    const { title, serviceType, priority, clientSource, description, clientId, value, deliveryDate, startDate, notes, progress } = req.body || {};
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (serviceType !== undefined) data.serviceType = serviceType;
    if (priority !== undefined) data.priority = priority || existing.priority;
    if (clientSource !== undefined) data.clientSource = clientSource || null;
    if (description !== undefined) data.description = description;
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

// إنشاء/تفعيل رابط مشاركة عام للعميل
router.post(
  "/:id/share",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    let token = project.publicToken;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      await prisma.project.update({ where: { id }, data: { publicToken: token } });
      await logActivity({
        userId: req.user!.id,
        action: "share_project",
        entityType: "project",
        entityId: id,
        projectId: id,
        description: `تفعيل رابط مشاركة للمشروع ${project.projectNumber}`,
      });
    }
    res.json({ token });
  })
);

// إلغاء رابط المشاركة
router.delete(
  "/:id/share",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    await prisma.project.update({ where: { id }, data: { publicToken: null } });
    await logActivity({
      userId: req.user!.id,
      action: "unshare_project",
      entityType: "project",
      entityId: id,
      projectId: id,
      description: `إلغاء رابط مشاركة المشروع ${project.projectNumber}`,
    });
    res.json({ message: "تم إلغاء الرابط" });
  })
);

// ملاحظات المشروع
router.post(
  "/:id/notes",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { text, type, status, assigneeSpecialistId } = req.body || {};
    if (!text) return res.status(400).json({ message: "نص الملاحظة مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const nextNo = (await prisma.note.count({ where: { projectId } })) + 1;
    const note = await prisma.note.create({
      data: {
        projectId,
        noteNumber: nextNo,
        text,
        type: type || "general",
        status: status || "new",
        assigneeSpecialistId: assigneeSpecialistId ? Number(assigneeSpecialistId) : null,
        authorId: req.user!.id,
        closedAt: status === "closed" ? new Date() : null,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_note",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `إضافة ملاحظة #${nextNo} للمشروع ${project.projectNumber}`,
    });
    res.status(201).json(note);
  })
);

router.patch(
  "/:id/notes/:noteId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    const { text, status, assigneeSpecialistId, type } = req.body || {};
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.projectId !== projectId) return res.status(404).json({ message: "الملاحظة غير موجودة" });
    const updated = await prisma.note.update({
      where: { id: noteId },
      data: {
        text: text !== undefined ? String(text) : undefined,
        type: type !== undefined ? String(type) : undefined,
        status: status !== undefined ? String(status) : undefined,
        assigneeSpecialistId: assigneeSpecialistId !== undefined ? (assigneeSpecialistId ? Number(assigneeSpecialistId) : null) : undefined,
        closedAt: status === "closed" ? new Date() : status !== undefined ? null : undefined,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_note",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `تحديث حالة/بيانات الملاحظة #${updated.noteNumber} للمشروع`,
    });
    res.json(updated);
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

// مهام المشروع
router.post(
  "/:id/tasks",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { title, description, specialistId, deliveryDate, status, progress } = req.body || {};
    if (!title) return res.status(400).json({ message: "اسم المهمة مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title,
        description,
        specialistId: specialistId ? Number(specialistId) : null,
        deliveryDate: parseDate(deliveryDate),
        status: status || "new",
        progress: parseNumber(progress, 0)!,
        createdById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_task",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `إضافة مهمة جديدة للمشروع ${project.projectNumber}: ${task.title}`,
    });
    res.status(201).json(task);
  })
);

router.put(
  "/:id/tasks/:taskId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const taskId = Number(req.params.taskId);
    const { title, description, specialistId, deliveryDate, status, progress } = req.body || {};
    const existing = await prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.projectId !== projectId) return res.status(404).json({ message: "المهمة غير موجودة" });
    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? String(title) : undefined,
        description: description !== undefined ? String(description) : undefined,
        specialistId: specialistId !== undefined ? (specialistId ? Number(specialistId) : null) : undefined,
        deliveryDate: deliveryDate !== undefined ? parseDate(deliveryDate) : undefined,
        status: status !== undefined ? String(status) : undefined,
        progress: progress !== undefined ? parseNumber(progress, existing.progress) : undefined,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_task",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `تحديث مهمة "${task.title}"`,
    });
    res.json(task);
  })
);

router.delete(
  "/:id/tasks/:taskId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const taskId = Number(req.params.taskId);
    const existing = await prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.projectId !== projectId) return res.status(404).json({ message: "المهمة غير موجودة" });
    await prisma.projectTask.delete({ where: { id: taskId } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_task",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `حذف مهمة "${existing.title}"`,
    });
    res.json({ message: "تم الحذف" });
  })
);

// تسليمات المشروع
router.post(
  "/:id/deliveries",
  authorize("projects", "edit"),
  uploadDelivery.single("file"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { specialistId, note, deliveredAt, fileName } = req.body || {};
    if (!req.file) return res.status(400).json({ message: "الملف مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const delivery = await prisma.projectDelivery.create({
      data: {
        projectId,
        specialistId: specialistId ? Number(specialistId) : null,
        note,
        deliveredAt: parseDate(deliveredAt) || new Date(),
        fileName: fileName || originalName,
        originalName,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_delivery",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `إضافة تسليم للمشروع ${project.projectNumber}: ${delivery.fileName}`,
    });
    res.status(201).json(delivery);
  })
);

router.get(
  "/:id/deliveries/:deliveryId/download",
  authorize("projects", "view"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const deliveryId = Number(req.params.deliveryId);
    const delivery = await prisma.projectDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.projectId !== projectId) return res.status(404).json({ message: "التسليم غير موجود" });
    const filePath = path.join(env.uploadDir, delivery.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود على الخادم" });
    res.download(filePath, delivery.originalName || delivery.fileName);
  })
);

router.delete(
  "/:id/deliveries/:deliveryId",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const deliveryId = Number(req.params.deliveryId);
    const delivery = await prisma.projectDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.projectId !== projectId) return res.status(404).json({ message: "التسليم غير موجود" });
    const filePath = path.join(env.uploadDir, delivery.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.projectDelivery.delete({ where: { id: deliveryId } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_delivery",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `حذف تسليم: ${delivery.fileName}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

// محادثات المشروع
router.post(
  "/:id/messages",
  authorize("projects", "view"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ message: "نص الرسالة مطلوب" });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    const msg = await prisma.projectMessage.create({
      data: { projectId, body: String(body), authorId: req.user!.id },
      include: { author: { select: { name: true, role: { select: { nameAr: true } } } } },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_message",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `إضافة رسالة داخلية للمشروع ${project.projectNumber}`,
    });
    res.status(201).json({
      id: msg.id,
      body: msg.body,
      author: msg.author?.name || "النظام",
      authorRole: msg.author?.role?.nameAr || "",
      createdAt: msg.createdAt,
    });
  })
);

export default router;
