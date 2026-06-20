import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { round2 } from "../utils/finance";

const router = Router();
router.use(authenticate);

export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const OPEN_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation"];

// قائمة المستخدمين المتاحين كمالكين (متاح لمن يملك صلاحية خطوط الأنابيب)
router.get(
  "/owners",
  authorize("pipeline", "view"),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    res.json(users);
  })
);

// إحصائيات خط الأنابيب
router.get(
  "/stats",
  authorize("pipeline", "view"),
  asyncHandler(async (_req, res) => {
    const leads = await prisma.lead.findMany();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let openValue = 0,
      openCount = 0,
      wonValue = 0,
      wonCount = 0,
      lostCount = 0,
      wonThisMonth = 0;
    for (const l of leads) {
      if (OPEN_STAGES.includes(l.stage)) {
        openValue += l.value;
        openCount++;
      } else if (l.stage === "won") {
        wonValue += l.value;
        wonCount++;
        if (l.updatedAt >= monthStart) wonThisMonth += l.value;
      } else if (l.stage === "lost") {
        lostCount++;
      }
    }
    const closed = wonCount + lostCount;
    res.json({
      openValue: round2(openValue),
      openCount,
      wonValue: round2(wonValue),
      wonCount,
      lostCount,
      wonThisMonth: round2(wonThisMonth),
      conversionRate: closed ? Math.round((wonCount / closed) * 100) : 0,
    });
  })
);

router.get(
  "/",
  authorize("pipeline", "view"),
  asyncHandler(async (req, res) => {
    const { search, owner } = req.query as Record<string, string>;
    const where: any = {};
    if (owner && owner !== "all") where.ownerId = Number(owner);
    if (search) {
      where.OR = [{ title: { contains: search } }, { clientName: { contains: search } }, { phone: { contains: search } }];
    }
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { id: true, name: true } }, _count: { select: { leadNotes: true } } },
    });
    res.json(leads);
  })
);

router.get(
  "/:id",
  authorize("pipeline", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        leadNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      },
    });
    if (!lead) return res.status(404).json({ message: "الفرصة غير موجودة" });
    res.json(lead);
  })
);

router.post(
  "/",
  authorize("pipeline", "create"),
  asyncHandler(async (req, res) => {
    const { title, clientName, phone, email, source, value, stage, expectedCloseDate, notes, ownerId } = req.body || {};
    if (!title || !clientName) return res.status(400).json({ message: "عنوان الفرصة واسم العميل مطلوبان" });
    const lead = await prisma.lead.create({
      data: {
        title,
        clientName,
        phone,
        email,
        source,
        value: parseNumber(value, 0)!,
        stage: LEAD_STAGES.includes(stage) ? stage : "new",
        expectedCloseDate: parseDate(expectedCloseDate),
        notes,
        ownerId: ownerId ? Number(ownerId) : req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_lead",
      entityType: "lead",
      entityId: lead.id,
      description: `إضافة فرصة بيعية: ${lead.title}`,
    });
    res.status(201).json(lead);
  })
);

router.put(
  "/:id",
  authorize("pipeline", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفرصة غير موجودة" });
    const { title, clientName, phone, email, source, value, stage, expectedCloseDate, notes, ownerId, lostReason } = req.body || {};
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        title,
        clientName,
        phone,
        email,
        source,
        value: value !== undefined ? parseNumber(value, existing.value) : existing.value,
        stage: stage && LEAD_STAGES.includes(stage) ? stage : existing.stage,
        expectedCloseDate: expectedCloseDate !== undefined ? parseDate(expectedCloseDate) || null : existing.expectedCloseDate,
        notes,
        lostReason,
        ownerId: ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : existing.ownerId,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_lead",
      entityType: "lead",
      entityId: lead.id,
      description: `تعديل فرصة: ${lead.title}`,
    });
    res.json(lead);
  })
);

// نقل المرحلة (سحب وإفلات)
router.patch(
  "/:id/stage",
  authorize("pipeline", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { stage, lostReason } = req.body || {};
    if (!LEAD_STAGES.includes(stage)) return res.status(400).json({ message: "مرحلة غير صحيحة" });
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفرصة غير موجودة" });
    const lead = await prisma.lead.update({
      where: { id },
      data: { stage, lostReason: stage === "lost" ? lostReason || existing.lostReason : existing.lostReason },
    });
    await logActivity({
      userId: req.user!.id,
      action: "lead_stage",
      entityType: "lead",
      entityId: id,
      description: `نقل الفرصة "${lead.title}" إلى مرحلة ${stage}`,
    });
    res.json(lead);
  })
);

router.post(
  "/:id/notes",
  authorize("pipeline", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { text, type } = req.body || {};
    if (!text) return res.status(400).json({ message: "النص مطلوب" });
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ message: "الفرصة غير موجودة" });
    const note = await prisma.leadNote.create({
      data: { leadId: id, text, type: type || "note", authorId: req.user!.id },
    });
    res.status(201).json(note);
  })
);

// تحويل فرصة رابحة إلى عميل (ومشروع اختياري)
router.post(
  "/:id/convert",
  authorize("pipeline", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { createProject } = req.body || {};
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ message: "الفرصة غير موجودة" });

    let clientId = lead.convertedClientId;
    if (!clientId) {
      const client = await prisma.client.create({
        data: { name: lead.clientName, phone: lead.phone, notes: `محوّل من فرصة بيعية: ${lead.title}` },
      });
      clientId = client.id;
    }

    let projectId = lead.convertedProjectId;
    if (createProject && !projectId) {
      const count = await prisma.project.count();
      const project = await prisma.project.create({
        data: {
          projectNumber: `PRJ-${String(count + 1).padStart(4, "0")}`,
          title: lead.title,
          clientId,
          value: lead.value,
          status: "new",
        },
      });
      projectId = project.id;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { stage: "won", convertedClientId: clientId, convertedProjectId: projectId },
    });
    await logActivity({
      userId: req.user!.id,
      action: "convert_lead",
      entityType: "lead",
      entityId: id,
      projectId: projectId || undefined,
      description: `تحويل الفرصة "${lead.title}" إلى عميل${projectId ? " ومشروع" : ""}`,
    });
    res.json({ lead: updated, clientId, projectId });
  })
);

router.delete(
  "/:id",
  authorize("pipeline", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفرصة غير موجودة" });
    await prisma.lead.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_lead",
      entityType: "lead",
      entityId: id,
      description: `حذف فرصة: ${existing.title}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
