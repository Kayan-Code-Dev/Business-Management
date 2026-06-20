import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";
import { emptyPermissions, parsePermissions, MODULES } from "../permissions";

const router = Router();
router.use(authenticate);

// قائمة الأدوار (متاحة لمن يملك صلاحية المستخدمين)
router.get(
  "/",
  authorize("users", "view"),
  asyncHandler(async (req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { users: true } } },
    });
    res.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: r.isSystem,
        usersCount: r._count.users,
        permissions: parsePermissions(r.permissions),
      }))
    );
  })
);

router.get("/modules", authenticate, (_req, res) => res.json({ modules: MODULES }));

router.post(
  "/",
  authorize("users", "create"),
  asyncHandler(async (req, res) => {
    const { name, nameAr, description, permissions } = req.body || {};
    if (!name || !nameAr) return res.status(400).json({ message: "اسم الدور مطلوب" });
    const dup = await prisma.role.findUnique({ where: { name } });
    if (dup) return res.status(400).json({ message: "اسم الدور مستخدم مسبقاً" });
    const perms = permissions || emptyPermissions();
    const role = await prisma.role.create({
      data: { name, nameAr, description, permissions: JSON.stringify(perms), isSystem: false },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_role",
      entityType: "role",
      entityId: role.id,
      description: `إضافة دور: ${role.nameAr}`,
    });
    res.status(201).json({ id: role.id });
  })
);

router.put(
  "/:id",
  authorize("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { nameAr, description, permissions } = req.body || {};
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الدور غير موجود" });
    const data: any = {};
    if (nameAr !== undefined) data.nameAr = nameAr;
    if (description !== undefined) data.description = description;
    if (permissions !== undefined) data.permissions = JSON.stringify(permissions);
    const role = await prisma.role.update({ where: { id }, data });
    await logActivity({
      userId: req.user!.id,
      action: "update_role",
      entityType: "role",
      entityId: role.id,
      description: `تعديل صلاحيات دور: ${role.nameAr}`,
    });
    res.json({ id: role.id });
  })
);

router.delete(
  "/:id",
  authorize("users", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!existing) return res.status(404).json({ message: "الدور غير موجود" });
    if (existing.isSystem) return res.status(400).json({ message: "لا يمكن حذف دور أساسي" });
    if (existing._count.users > 0) return res.status(400).json({ message: "لا يمكن حذف دور مرتبط بمستخدمين" });
    await prisma.role.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_role",
      entityType: "role",
      entityId: id,
      description: `حذف دور: ${existing.nameAr}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
