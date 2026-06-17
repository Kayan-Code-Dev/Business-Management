import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/http";
import { env } from "../env";
import { financeFromProject, isProjectLate, STATUS_LABELS_AR, PROJECT_STATUSES } from "../utils/finance";

const router = Router();

async function getOrg() {
  const s = await prisma.setting.findUnique({ where: { key: "org" } });
  const def = { name: "إدارة المشاريع", logo: "", phone: "", email: "", currency: "ر.س", address: "" };
  if (!s) return def;
  try {
    return { ...def, ...JSON.parse(s.value) };
  } catch {
    return def;
  }
}

// بيانات المشروع للعميل عبر الرابط العام (بدون بيانات داخلية)
router.get(
  "/projects/:token",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    const project = await prisma.project.findUnique({
      where: { publicToken: token },
      include: {
        client: { select: { name: true } },
        payments: true,
        specialists: { include: { specialist: { select: { name: true } } } },
        expenses: true,
        files: { where: { category: { in: ["client", "general"] } }, orderBy: { createdAt: "desc" } },
        projectNotes: { where: { type: { not: "internal" } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) return res.status(404).json({ message: "الرابط غير صالح أو منتهي" });

    const fin = financeFromProject(project);
    const org = await getOrg();

    // أحدث فاتورة للمشروع (للاستحقاق)
    const invoice = await prisma.invoice.findFirst({
      where: { projectId: project.id, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true, dueDate: true, total: true, status: true },
    });

    let serviceTypeLabel = project.serviceType || "";
    if (project.serviceType) {
      const lk = await prisma.lookup.findFirst({ where: { category: "service_type", value: project.serviceType } });
      if (lk) serviceTypeLabel = lk.label;
    }

    const statusIndex = PROJECT_STATUSES.indexOf(project.status as any);

    // سجل تحديثات آمن (إجراءات لا تكشف بيانات داخلية)
    const SAFE_ACTIONS = ["create_project", "change_status", "add_note", "client_payment"];
    const logs = await prisma.activityLog.findMany({
      where: { projectId: project.id, action: { in: SAFE_ACTIONS } },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    res.json({
      org: { name: org.name, logo: org.logo, phone: org.phone, email: org.email, currency: org.currency },
      project: {
        projectNumber: project.projectNumber,
        title: project.title,
        serviceType: serviceTypeLabel,
        status: project.status,
        statusLabel: STATUS_LABELS_AR[project.status] || project.status,
        statusIndex,
        isLate: isProjectLate(project.status, project.deliveryDate),
        progress: project.progress,
        startDate: project.startDate,
        deliveryDate: project.deliveryDate,
        completedAt: project.completedAt,
        clientName: project.client?.name,
        notes: project.notes,
      },
      finance: {
        currency: org.currency,
        value: fin.value,
        paid: fin.clientPaid,
        remaining: fin.clientRemaining,
        dueDate: invoice?.dueDate || project.deliveryDate,
        invoiceNumber: invoice?.invoiceNumber || null,
        invoiceStatus: invoice?.status || null,
      },
      payments: project.payments
        .filter((p) => p.type === "client_in")
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .map((p) => ({ id: p.id, amount: p.amount, date: p.date, method: p.method, note: p.note })),
      notes: project.projectNotes.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
      files: project.files.map((f) => ({ id: f.id, name: f.name, category: f.category, size: f.size, createdAt: f.createdAt })),
      team: project.specialists.map((s) => ({ name: s.specialist?.name, role: s.role || "عضو فريق" })),
      timeline: logs.map((l) => ({ action: l.action, description: l.description, createdAt: l.createdAt })),
      stats: {
        paymentsCount: project.payments.filter((p) => p.type === "client_in").length,
        filesCount: project.files.length,
        teamCount: project.specialists.length,
      },
    });
  })
);

// تنزيل ملف عبر الرابط العام (فقط ملفات العميل/العامة)
router.get(
  "/projects/:token/files/:fileId/download",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    const fileId = Number(req.params.fileId);
    const project = await prisma.project.findUnique({ where: { publicToken: token }, select: { id: true } });
    if (!project) return res.status(404).json({ message: "الرابط غير صالح" });
    const file = await prisma.fileAttachment.findUnique({ where: { id: fileId } });
    if (!file || file.projectId !== project.id || file.category === "specialist") {
      return res.status(404).json({ message: "الملف غير متاح" });
    }
    const filePath = path.join(env.uploadDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود" });
    res.download(filePath, file.originalName || file.name);
  })
);

export default router;
