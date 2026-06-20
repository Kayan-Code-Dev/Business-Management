import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";
import { financeFromProject, round2, STATUS_LABELS_AR, isProjectLate, CLOSED_STATUSES } from "../utils/finance";
import { env } from "../env";

const router = Router();
router.use(authenticate);

if (!fs.existsSync(env.uploadDir)) fs.mkdirSync(env.uploadDir, { recursive: true });
const clientStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const uploadClientFile = multer({ storage: clientStorage, limits: { fileSize: 25 * 1024 * 1024 } });

const SOURCE_LABELS: Record<string, string> = {
  facebook: "فيسبوك",
  instagram: "إنستغرام",
  whatsapp: "واتساب",
  website: "موقع إلكتروني",
  referral: "توصية",
  other: "أخرى",
};
const STATUS_LABELS: Record<string, string> = {
  active: "عميل نشط",
  potential: "عميل محتمل",
  inactive: "عميل متوقف",
};

// قائمة العملاء مع ملخص مالي وتشغيلي
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
        { email: { contains: search } },
        { university: { contains: search } },
        { specialization: { contains: search } },
      ];
    }
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        projects: {
          select: { id: true, value: true, title: true, projectNumber: true, createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
        },
        payments: { where: { type: "client_in" }, select: { amount: true, date: true } },
      },
    });

    const result = clients.map((c) => {
      const totalValue = c.projects.reduce((s, p) => s + p.value, 0);
      const totalPaid = c.payments.reduce((s, p) => s + p.amount, 0);
      const latestProject = c.projects[0] || null;
      const latestPaymentDate = c.payments.length ? c.payments.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0].date : null;
      const latestInteraction = latestProject
        ? latestPaymentDate
          ? new Date(Math.max(+new Date(latestProject.createdAt), +new Date(latestPaymentDate)))
          : latestProject.createdAt
        : latestPaymentDate;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        country: c.country,
        university: c.university,
        academicDegree: c.academicDegree,
        source: c.source,
        sourceLabel: c.source ? SOURCE_LABELS[c.source] || c.source : "—",
        status: c.status,
        statusLabel: STATUS_LABELS[c.status] || c.status,
        specialization: c.specialization,
        notes: c.notes,
        projectsCount: c.projects.length,
        totalPaid: round2(totalPaid),
        totalRemaining: round2(totalValue - totalPaid),
        lastProjectTitle: latestProject?.title || null,
        lastProjectNumber: latestProject?.projectNumber || null,
        lastInteractionDate: latestInteraction || null,
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
            specialists: { include: { specialist: { select: { id: true, name: true } } } },
            expenses: true,
          },
          orderBy: { createdAt: "desc" },
        },
        payments: { orderBy: { date: "desc" }, include: { project: { select: { id: true, projectNumber: true, title: true } } } },
        attachments: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
        clientNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      },
    });
    if (!client) return res.status(404).json({ message: "العميل غير موجود" });

    const canSeeProfits = req.user!.permissions.flags.viewProfits;
    const projects = client.projects.map((p) => {
      const fin = financeFromProject(p);
      const responsible = p.specialists.map((s) => s.specialist?.name).filter(Boolean).join("، ");
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
        responsibleSpecialist: responsible || "غير محدد",
        value: fin.value,
        clientPaid: fin.clientPaid,
        clientRemaining: fin.clientRemaining,
        ...(canSeeProfits ? { netProfit: fin.netProfit } : {}),
      };
    });
    const totalPaid = client.payments.filter((p) => p.type === "client_in").reduce((s, p) => s + p.amount, 0);
    const totalValue = client.projects.reduce((s, p) => s + p.value, 0);
    const activeProjects = client.projects.filter((p) => !CLOSED_STATUSES.includes(p.status)).length;
    const completedProjects = client.projects.filter((p) => p.status === "completed").length;
    const lastProject = client.projects[0] || null;
    const lastPaymentDate = client.payments.find((p) => p.type === "client_in")?.date || null;

    res.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      country: client.country,
      university: client.university,
      academicDegree: client.academicDegree,
      source: client.source,
      sourceLabel: client.source ? SOURCE_LABELS[client.source] || client.source : "—",
      status: client.status,
      statusLabel: STATUS_LABELS[client.status] || client.status,
      specialization: client.specialization,
      notes: client.notes,
      createdAt: client.createdAt,
      summary: {
        projectsCount: client.projects.length,
        activeProjects,
        completedProjects,
        totalValue: round2(totalValue),
        totalPaid: round2(totalPaid),
        totalRemaining: round2(totalValue - totalPaid),
        lastPaymentDate,
        lastProjectTitle: lastProject?.title || null,
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
      files: client.attachments.map((f) => ({
        id: f.id,
        name: f.name,
        originalName: f.originalName,
        size: f.size,
        mimeType: f.mimeType,
        uploadedBy: f.uploadedBy?.name,
        createdAt: f.createdAt,
      })),
      notesList: client.clientNotes.map((n) => ({
        id: n.id,
        text: n.text,
        author: n.author?.name || "النظام",
        createdAt: n.createdAt,
      })),
    });
  })
);

router.post(
  "/",
  authorize("clients", "create"),
  asyncHandler(async (req, res) => {
    const { name, phone, email, country, university, academicDegree, source, status, specialization, notes } = req.body || {};
    if (!name) return res.status(400).json({ message: "اسم العميل مطلوب" });
    const client = await prisma.client.create({
      data: { name, phone, email, country, university, academicDegree, source, status: status || "active", specialization, notes },
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
    const { name, phone, email, country, university, academicDegree, source, status, specialization, notes } = req.body || {};
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "العميل غير موجود" });
    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        country,
        university,
        academicDegree,
        source,
        status,
        specialization,
        notes,
      },
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

// مرفقات العميل العامة
router.post(
  "/:id/files",
  authorize("clients", "edit"),
  uploadClientFile.single("file"),
  asyncHandler(async (req, res) => {
    const clientId = Number(req.params.id);
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ message: "العميل غير موجود" });
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });
    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const file = await prisma.clientAttachment.create({
      data: {
        clientId,
        name: (req.body.name as string) || originalName,
        originalName,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_client_file",
      entityType: "client",
      entityId: clientId,
      description: `رفع ملف للعميل ${client.name}`,
    });
    res.status(201).json(file);
  })
);

router.get(
  "/:id/files/:fileId/download",
  authorize("clients", "view"),
  asyncHandler(async (req, res) => {
    const clientId = Number(req.params.id);
    const fileId = Number(req.params.fileId);
    const file = await prisma.clientAttachment.findUnique({ where: { id: fileId } });
    if (!file || file.clientId !== clientId) return res.status(404).json({ message: "الملف غير موجود" });
    const filePath = path.join(env.uploadDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود على الخادم" });
    res.download(filePath, file.originalName || file.name);
  })
);

router.delete(
  "/:id/files/:fileId",
  authorize("clients", "edit"),
  asyncHandler(async (req, res) => {
    const clientId = Number(req.params.id);
    const fileId = Number(req.params.fileId);
    const file = await prisma.clientAttachment.findUnique({ where: { id: fileId } });
    if (!file || file.clientId !== clientId) return res.status(404).json({ message: "الملف غير موجود" });
    const filePath = path.join(env.uploadDir, file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.clientAttachment.delete({ where: { id: fileId } });
    res.json({ message: "تم الحذف" });
  })
);

// ملاحظات داخلية على العميل
router.post(
  "/:id/notes",
  authorize("clients", "edit"),
  asyncHandler(async (req, res) => {
    const clientId = Number(req.params.id);
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ message: "نص الملاحظة مطلوب" });
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ message: "العميل غير موجود" });
    const note = await prisma.clientNote.create({
      data: { clientId, text, authorId: req.user!.id },
    });
    await logActivity({
      userId: req.user!.id,
      action: "add_client_note",
      entityType: "client",
      entityId: clientId,
      description: `إضافة ملاحظة على العميل ${client.name}`,
    });
    res.status(201).json(note);
  })
);

router.delete(
  "/:id/notes/:noteId",
  authorize("clients", "edit"),
  asyncHandler(async (req, res) => {
    const clientId = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    const note = await prisma.clientNote.findUnique({ where: { id: noteId } });
    if (!note || note.clientId !== clientId) return res.status(404).json({ message: "الملاحظة غير موجودة" });
    await prisma.clientNote.delete({ where: { id: noteId } });
    res.json({ message: "تم الحذف" });
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
