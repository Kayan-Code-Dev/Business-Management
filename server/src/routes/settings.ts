import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(authenticate);

const DEFAULT_SETTINGS: Record<string, any> = {
  org: { name: "شركتي", phone: "", email: "", address: "", logo: "", currency: "ر.س" },
  notifications: { projectCreated: true, taskAssigned: true, nearDelivery: true, newNote: true },
};

// قراءة الإعدادات (متاح لكل مستخدم لأخذ العملة واسم الشركة)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.setting.findMany();
    const map: Record<string, any> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      try {
        map[r.key] = JSON.parse(r.value);
      } catch {
        map[r.key] = r.value;
      }
    }
    res.json(map);
  })
);

router.put(
  "/:key",
  authorize("settings", "edit"),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    const value = JSON.stringify(req.body?.value ?? req.body ?? {});
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_settings",
      entityType: "setting",
      description: `تحديث إعدادات: ${key}`,
    });
    res.json({ message: "تم الحفظ" });
  })
);

// نسخة احتياطية - تنزيل JSON
router.get(
  "/backup/export",
  authorize("settings", "view"),
  asyncHandler(async (req, res) => {
    if (!req.user!.permissions.flags.manageBackups) {
      return res.status(403).json({ message: "ليس لديك صلاحية النسخ الاحتياطي" });
    }
    const data = {
      exportedAt: new Date().toISOString(),
      clients: await prisma.client.findMany(),
      specialists: await prisma.specialist.findMany(),
      projects: await prisma.project.findMany(),
      projectSpecialists: await prisma.projectSpecialist.findMany(),
      payments: await prisma.payment.findMany(),
      expenses: await prisma.expense.findMany(),
      invoices: await prisma.invoice.findMany({ include: { items: true } }),
      notes: await prisma.note.findMany(),
      files: await prisma.fileAttachment.findMany(),
      tasks: await prisma.projectTask.findMany(),
      deliveries: await prisma.projectDelivery.findMany(),
      messages: await prisma.projectMessage.findMany(),
      lookups: await prisma.lookup.findMany(),
      settings: await prisma.setting.findMany(),
      users: (await prisma.user.findMany()).map((u) => ({ ...u, passwordHash: undefined })),
      roles: await prisma.role.findMany(),
    };
    await logActivity({ userId: req.user!.id, action: "backup_export", description: "تصدير نسخة احتياطية" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${Date.now()}.json"`);
    res.send(JSON.stringify(data, null, 2));
  })
);

export default router;
