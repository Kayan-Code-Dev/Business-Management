import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/http";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(authenticate);

export const LOOKUP_CATEGORIES = [
  "service_type",
  "specialization",
  "skill",
  "experience_level",
  "payment_method",
  "expense_type",
];

// متاح لكل مستخدم مسجّل (لتعبئة القوائم المنسدلة)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const category = req.query.category as string;
    const where: any = { isActive: true };
    if (category) where.category = category;
    const lookups = await prisma.lookup.findMany({ where, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
    res.json(lookups);
  })
);

router.post(
  "/",
  authorize("settings", "create"),
  asyncHandler(async (req, res) => {
    const { category, value, label, sortOrder } = req.body || {};
    if (!category || !value || !label) return res.status(400).json({ message: "البيانات ناقصة" });
    if (!LOOKUP_CATEGORIES.includes(category)) return res.status(400).json({ message: "تصنيف غير صحيح" });
    const dup = await prisma.lookup.findUnique({ where: { category_value: { category, value } } });
    if (dup) return res.status(400).json({ message: "القيمة موجودة مسبقاً" });
    const lookup = await prisma.lookup.create({
      data: { category, value, label, sortOrder: Number(sortOrder) || 0 },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_lookup",
      entityType: "lookup",
      entityId: lookup.id,
      description: `إضافة عنصر إعدادات: ${label}`,
    });
    res.status(201).json(lookup);
  })
);

router.put(
  "/:id",
  authorize("settings", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { label, sortOrder, isActive } = req.body || {};
    const lookup = await prisma.lookup.update({
      where: { id },
      data: {
        label,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
      },
    });
    res.json(lookup);
  })
);

router.delete(
  "/:id",
  authorize("settings", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.lookup.delete({ where: { id } });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
