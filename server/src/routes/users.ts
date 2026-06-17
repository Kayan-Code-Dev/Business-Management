import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("users", "view"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { role: { select: { id: true, name: true, nameAr: true } }, specialist: { select: { id: true, name: true } } },
    });
    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        role: u.role,
        specialist: u.specialist,
        createdAt: u.createdAt,
      }))
    );
  })
);

router.post(
  "/",
  authorize("users", "create"),
  asyncHandler(async (req, res) => {
    const { name, username, email, phone, password, roleId, specialistId } = req.body || {};
    if (!name || !username || !password || !roleId) {
      return res.status(400).json({ message: "الاسم واسم المستخدم وكلمة المرور والدور مطلوبة" });
    }
    const dup = await prisma.user.findUnique({ where: { username } });
    if (dup) return res.status(400).json({ message: "اسم المستخدم مستخدم مسبقاً" });
    const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
    if (!role) return res.status(400).json({ message: "الدور غير موجود" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        phone,
        passwordHash,
        roleId: Number(roleId),
        specialistId: specialistId ? Number(specialistId) : null,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_user",
      entityType: "user",
      entityId: user.id,
      description: `إضافة مستخدم: ${user.name} (${role.nameAr})`,
    });
    res.status(201).json({ id: user.id });
  })
);

router.put(
  "/:id",
  authorize("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, email, phone, roleId, specialistId } = req.body || {};
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المستخدم غير موجود" });
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        roleId: roleId ? Number(roleId) : existing.roleId,
        specialistId: specialistId === undefined ? existing.specialistId : specialistId ? Number(specialistId) : null,
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_user",
      entityType: "user",
      entityId: user.id,
      description: `تعديل مستخدم: ${user.name}`,
    });
    res.json({ id: user.id });
  })
);

router.patch(
  "/:id/status",
  authorize("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = req.body || {};
    if (id === req.user!.id) return res.status(400).json({ message: "لا يمكنك تعطيل حسابك" });
    const user = await prisma.user.update({ where: { id }, data: { isActive: !!isActive } });
    await logActivity({
      userId: req.user!.id,
      action: isActive ? "enable_user" : "disable_user",
      entityType: "user",
      entityId: id,
      description: `${isActive ? "تفعيل" : "تعطيل"} مستخدم: ${user.name}`,
    });
    res.json({ id: user.id, isActive: user.isActive });
  })
);

router.patch(
  "/:id/password",
  authorize("users", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: "كلمة المرور مطلوبة" });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.update({ where: { id }, data: { passwordHash } });
    await logActivity({
      userId: req.user!.id,
      action: "reset_password",
      entityType: "user",
      entityId: id,
      description: `إعادة تعيين كلمة مرور: ${user.name}`,
    });
    res.json({ message: "تم تغيير كلمة المرور" });
  })
);

router.delete(
  "/:id",
  authorize("users", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) return res.status(400).json({ message: "لا يمكنك حذف حسابك" });
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "المستخدم غير موجود" });
    await prisma.user.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_user",
      entityType: "user",
      entityId: id,
      description: `حذف مستخدم: ${existing.name}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
