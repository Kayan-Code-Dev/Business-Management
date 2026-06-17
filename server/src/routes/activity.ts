import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/http";

const router = Router();
router.use(authenticate);

// سجل النشاطات - متاح لمن لديه صلاحية عرض الإعدادات أو المستخدمين أو الأدمن
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const perms = req.user!.permissions.modules;
    if (!perms.settings.view && !perms.users.view && req.user!.roleName !== "admin") {
      return res.status(403).json({ message: "ليس لديك صلاحية لعرض سجل النشاطات" });
    }
    const { search, action, page = "1", pageSize = "30" } = req.query as Record<string, string>;
    const where: any = {};
    if (action && action !== "all") where.action = action;
    if (search) where.description = { contains: search };
    const take = Math.min(Number(pageSize) || 30, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { user: { select: { name: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);
    res.json({
      total,
      page: Number(page) || 1,
      pageSize: take,
      items: items.map((a) => ({
        id: a.id,
        action: a.action,
        description: a.description,
        entityType: a.entityType,
        projectId: a.projectId,
        user: a.user?.name,
        createdAt: a.createdAt,
      })),
    });
  })
);

export default router;
