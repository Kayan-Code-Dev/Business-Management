import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler, parseDate, parseNumber } from "../utils/http";
import { logActivity } from "../utils/activity";
import { round2 } from "../utils/finance";

const router = Router();
router.use(authenticate);

const STATUSES = ["draft", "sent", "paid", "cancelled"];

function computeTotals(items: { quantity: number; unitPrice: number }[], discount: number, taxRate: number) {
  const normalized = items.map((it) => ({
    quantity: it.quantity || 0,
    unitPrice: it.unitPrice || 0,
    amount: round2((it.quantity || 0) * (it.unitPrice || 0)),
  }));
  const subtotal = round2(normalized.reduce((s, it) => s + it.amount, 0));
  const taxable = Math.max(0, subtotal - (discount || 0));
  const taxAmount = round2((taxable * (taxRate || 0)) / 100);
  const total = round2(taxable + taxAmount);
  return { normalized, subtotal, taxAmount, total };
}

async function nextInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  return `INV-${String(count + 1).padStart(4, "0")}`;
}

async function defaultCurrency(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: "org" } });
  if (s) {
    try {
      return JSON.parse(s.value).currency || "ر.س";
    } catch {
      /* ignore */
    }
  }
  return "ر.س";
}

// قائمة الفواتير
router.get(
  "/",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const { search, status } = req.query as Record<string, string>;
    const where: any = {};
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { client: { name: { contains: search } } },
      ];
    }
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, projectNumber: true } },
      },
    });
    res.json(invoices);
  })
);

// فاتورة مفردة
router.get(
  "/:id",
  authorize("financial", "view"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: { select: { id: true, projectNumber: true, title: true } },
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
      },
    });
    if (!invoice) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    res.json(invoice);
  })
);

// إنشاء فاتورة
router.post(
  "/",
  authorize("financial", "create"),
  asyncHandler(async (req, res) => {
    const { clientId, projectId, issueDate, dueDate, notes, discount, taxRate, items, status } = req.body || {};
    if (!clientId) return res.status(400).json({ message: "العميل مطلوب" });
    const cleanItems = (Array.isArray(items) ? items : []).filter((it: any) => it && it.description);
    if (cleanItems.length === 0) return res.status(400).json({ message: "أضف بنداً واحداً على الأقل" });

    const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
    if (!client) return res.status(400).json({ message: "العميل غير موجود" });

    const disc = parseNumber(discount, 0)!;
    const tax = parseNumber(taxRate, 0)!;
    const { normalized, subtotal, taxAmount, total } = computeTotals(
      cleanItems.map((it: any) => ({ quantity: parseNumber(it.quantity, 1)!, unitPrice: parseNumber(it.unitPrice, 0)! })),
      disc,
      tax
    );

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(),
        clientId: Number(clientId),
        projectId: projectId ? Number(projectId) : null,
        issueDate: parseDate(issueDate) || new Date(),
        dueDate: parseDate(dueDate),
        status: STATUSES.includes(status) ? status : "draft",
        currency: await defaultCurrency(),
        notes,
        discount: disc,
        taxRate: tax,
        subtotal,
        taxAmount,
        total,
        createdById: req.user!.id,
        items: {
          create: cleanItems.map((it: any, i: number) => ({
            description: it.description,
            quantity: normalized[i].quantity,
            unitPrice: normalized[i].unitPrice,
            amount: normalized[i].amount,
            sortOrder: i,
          })),
        },
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "create_invoice",
      entityType: "invoice",
      entityId: invoice.id,
      projectId: invoice.projectId || undefined,
      description: `إنشاء فاتورة ${invoice.invoiceNumber} بقيمة ${total}`,
    });
    res.status(201).json(invoice);
  })
);

// تعديل فاتورة
router.put(
  "/:id",
  authorize("financial", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفاتورة غير موجودة" });

    const { clientId, projectId, issueDate, dueDate, notes, discount, taxRate, items, status } = req.body || {};
    const cleanItems = (Array.isArray(items) ? items : []).filter((it: any) => it && it.description);
    if (cleanItems.length === 0) return res.status(400).json({ message: "أضف بنداً واحداً على الأقل" });

    const disc = parseNumber(discount, existing.discount)!;
    const tax = parseNumber(taxRate, existing.taxRate)!;
    const { normalized, subtotal, taxAmount, total } = computeTotals(
      cleanItems.map((it: any) => ({ quantity: parseNumber(it.quantity, 1)!, unitPrice: parseNumber(it.unitPrice, 0)! })),
      disc,
      tax
    );

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        clientId: clientId ? Number(clientId) : existing.clientId,
        projectId: projectId !== undefined ? (projectId ? Number(projectId) : null) : existing.projectId,
        issueDate: parseDate(issueDate) || existing.issueDate,
        dueDate: dueDate !== undefined ? parseDate(dueDate) || null : existing.dueDate,
        status: STATUSES.includes(status) ? status : existing.status,
        notes,
        discount: disc,
        taxRate: tax,
        subtotal,
        taxAmount,
        total,
        items: {
          create: cleanItems.map((it: any, i: number) => ({
            description: it.description,
            quantity: normalized[i].quantity,
            unitPrice: normalized[i].unitPrice,
            amount: normalized[i].amount,
            sortOrder: i,
          })),
        },
      },
    });
    await logActivity({
      userId: req.user!.id,
      action: "update_invoice",
      entityType: "invoice",
      entityId: invoice.id,
      description: `تعديل فاتورة ${invoice.invoiceNumber}`,
    });
    res.json(invoice);
  })
);

// تغيير الحالة
router.patch(
  "/:id/status",
  authorize("financial", "edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ message: "حالة غير صحيحة" });
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    const invoice = await prisma.invoice.update({ where: { id }, data: { status } });
    await logActivity({
      userId: req.user!.id,
      action: "invoice_status",
      entityType: "invoice",
      entityId: id,
      description: `تغيير حالة الفاتورة ${invoice.invoiceNumber} إلى ${status}`,
    });
    res.json(invoice);
  })
);

router.delete(
  "/:id",
  authorize("financial", "delete"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    await prisma.invoice.delete({ where: { id } });
    await logActivity({
      userId: req.user!.id,
      action: "delete_invoice",
      entityType: "invoice",
      entityId: id,
      description: `حذف فاتورة ${existing.invoiceNumber}`,
    });
    res.json({ message: "تم الحذف" });
  })
);

export default router;
