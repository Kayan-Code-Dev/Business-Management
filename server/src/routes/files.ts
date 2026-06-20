import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";
import { env } from "../env";

const router = Router();
router.use(authenticate);

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// رفع ملف لمشروع
router.post(
  "/projects/:id/files",
  authorize("projects", "edit"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: "المشروع غير موجود" });
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });

    const category = (req.body.category as string) || "general";
    const displayName = (req.body.name as string) || req.file.originalname;
    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    const file = await prisma.fileAttachment.create({
      data: {
        projectId,
        name: displayName,
        originalName,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category,
        uploadedById: req.user!.id,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "upload_file",
      entityType: "project",
      entityId: projectId,
      projectId,
      description: `رفع ملف (${category === "client" ? "عميل" : category === "specialist" ? "مختص" : "عام"}) للمشروع ${project.projectNumber}`,
    });
    res.status(201).json(file);
  })
);

// تنزيل ملف
router.get(
  "/files/:id/download",
  authorize("projects", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const file = await prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ message: "الملف غير موجود" });

    // حصر المختص على ملفات مشاريعه
    const flags = req.user!.permissions.flags;
    if (flags.onlyAssignedProjects) {
      const link = await prisma.projectSpecialist.findFirst({
        where: { projectId: file.projectId, specialistId: req.user!.specialistId || -1 },
      });
      if (!link) return res.status(403).json({ message: "ليس لديك صلاحية" });
    }

    const filePath = path.join(env.uploadDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود على الخادم" });
    res.download(filePath, file.originalName || file.name);
  })
);

// حذف ملف
router.delete(
  "/files/:id",
  authorize("projects", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const file = await prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ message: "الملف غير موجود" });
    const filePath = path.join(env.uploadDir, file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.fileAttachment.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_file",
      entityType: "project",
      entityId: file.projectId,
      projectId: file.projectId,
      description: `حذف ملف من المشروع`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
