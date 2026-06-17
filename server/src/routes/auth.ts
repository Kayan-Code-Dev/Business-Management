import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { signToken } from "../utils/auth";
import { parsePermissions } from "../permissions";
import { asyncHandler } from "../utils/http";
import { authenticate } from "../middleware/auth";
import { logActivity } from "../utils/activity";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }
    const user = await prisma.user.findUnique({
      where: { username: String(username) },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "بيانات الدخول غير صحيحة أو الحساب معطّل" });
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logActivity({ userId: user.id, action: "login", description: `تسجيل دخول المستخدم ${user.name}` });
    const token = signToken({ userId: user.id, username: user.username, roleName: user.role.name });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        roleName: user.role.name,
        roleNameAr: user.role.nameAr,
        permissions: parsePermissions(user.role.permissions),
        specialistId: user.specialistId,
      },
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "كلمة المرور الحالية والجديدة مطلوبتان" });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!ok) return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logActivity({ userId: user.id, action: "change_password", description: "تغيير كلمة المرور" });
    res.json({ message: "تم تغيير كلمة المرور" });
  })
);

export default router;
