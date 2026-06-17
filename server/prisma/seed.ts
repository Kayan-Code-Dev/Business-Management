import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../src/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("⏳ تهيئة البيانات...");

  // الأدوار
  const roleMap: Record<string, number> = {};
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { nameAr: r.nameAr, description: r.description, permissions: JSON.stringify(r.permissions), isSystem: true },
      create: {
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        permissions: JSON.stringify(r.permissions),
        isSystem: true,
      },
    });
    roleMap[r.name] = role.id;
  }

  // القوائم القابلة للإعداد
  const lookups: { category: string; value: string; label: string; sortOrder: number }[] = [
    { category: "service_type", value: "research", label: "بحث علمي", sortOrder: 1 },
    { category: "service_type", value: "graduation_project", label: "مشروع تخرج", sortOrder: 2 },
    { category: "service_type", value: "presentation", label: "عرض تقديمي", sortOrder: 3 },
    { category: "service_type", value: "translation", label: "ترجمة", sortOrder: 4 },
    { category: "service_type", value: "programming", label: "مشروع برمجي", sortOrder: 5 },
    { category: "specialization", value: "cs", label: "علوم حاسب", sortOrder: 1 },
    { category: "specialization", value: "business", label: "إدارة أعمال", sortOrder: 2 },
    { category: "specialization", value: "engineering", label: "هندسة", sortOrder: 3 },
    { category: "specialization", value: "medical", label: "علوم طبية", sortOrder: 4 },
    { category: "skill", value: "writing", label: "كتابة أكاديمية", sortOrder: 1 },
    { category: "skill", value: "spss", label: "تحليل SPSS", sortOrder: 2 },
    { category: "skill", value: "design", label: "تصميم", sortOrder: 3 },
    { category: "skill", value: "coding", label: "برمجة", sortOrder: 4 },
    { category: "experience_level", value: "junior", label: "مبتدئ", sortOrder: 1 },
    { category: "experience_level", value: "mid", label: "متوسط", sortOrder: 2 },
    { category: "experience_level", value: "senior", label: "خبير", sortOrder: 3 },
    { category: "payment_method", value: "cash", label: "نقداً", sortOrder: 1 },
    { category: "payment_method", value: "bank", label: "تحويل بنكي", sortOrder: 2 },
    { category: "payment_method", value: "wallet", label: "محفظة إلكترونية", sortOrder: 3 },
    { category: "expense_type", value: "marketing", label: "تسويق", sortOrder: 1 },
    { category: "expense_type", value: "tools", label: "أدوات وبرامج", sortOrder: 2 },
    { category: "expense_type", value: "other", label: "أخرى", sortOrder: 3 },
  ];
  for (const l of lookups) {
    await prisma.lookup.upsert({
      where: { category_value: { category: l.category, value: l.value } },
      update: { label: l.label, sortOrder: l.sortOrder },
      create: l,
    });
  }

  // الإعدادات
  await prisma.setting.upsert({
    where: { key: "org" },
    update: {},
    create: {
      key: "org",
      value: JSON.stringify({ name: "مؤسسة المشاريع الأكاديمية", phone: "0500000000", email: "info@example.com", address: "الرياض", logo: "", currency: "ر.س" }),
    },
  });

  // المستخدمون لكل دور
  const password = await bcrypt.hash("123456", 10);
  const users = [
    { name: "مدير النظام", username: "admin", role: "admin", email: "admin@example.com" },
    { name: "مدير المشاريع", username: "manager", role: "project_manager", email: "manager@example.com" },
    { name: "موظف خدمة العملاء", username: "service", role: "client_service", email: "service@example.com" },
    { name: "المحاسب", username: "accountant", role: "accountant", email: "accountant@example.com" },
    { name: "مندوب المبيعات", username: "sales", role: "sales", email: "sales@example.com" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { roleId: roleMap[u.role] },
      create: { name: u.name, username: u.username, email: u.email, passwordHash: password, roleId: roleMap[u.role] },
    });
  }

  // بيانات تجريبية إن لم توجد مشاريع
  const existingProjects = await prisma.project.count();
  if (existingProjects === 0) {
    const client1 = await prisma.client.create({
      data: { name: "أحمد العتيبي", phone: "0551112233", country: "السعودية", specialization: "إدارة أعمال", notes: "عميل دائم" },
    });
    const client2 = await prisma.client.create({
      data: { name: "سارة الحربي", phone: "0544445566", country: "السعودية", specialization: "علوم حاسب" },
    });
    const client3 = await prisma.client.create({
      data: { name: "محمد القحطاني", phone: "0533334455", country: "الإمارات", specialization: "هندسة" },
    });

    const spec1 = await prisma.specialist.create({
      data: { name: "د. خالد الزهراني", phone: "0560001122", email: "khaled@example.com", specialization: "علوم حاسب", skills: "برمجة، تحليل بيانات", experienceLevel: "خبير", paymentMethod: "تحويل بنكي" },
    });
    const spec2 = await prisma.specialist.create({
      data: { name: "أ. نورة السالم", phone: "0570002233", email: "noura@example.com", specialization: "إدارة أعمال", skills: "كتابة أكاديمية، تحليل SPSS", experienceLevel: "متوسط", paymentMethod: "نقداً" },
    });

    // ربط مستخدم مختص
    const specUser = await prisma.user.upsert({
      where: { username: "specialist" },
      update: { roleId: roleMap["specialist"], specialistId: spec1.id },
      create: {
        name: spec1.name,
        username: "specialist",
        email: spec1.email,
        passwordHash: password,
        roleId: roleMap["specialist"],
        specialistId: spec1.id,
      },
    });

    const p1 = await prisma.project.create({
      data: {
        projectNumber: "PRJ-0001",
        title: "نظام إدارة مكتبة - مشروع تخرج",
        serviceType: "graduation_project",
        clientId: client1.id,
        value: 5000,
        status: "in_progress",
        progress: 50,
        deliveryDate: new Date(Date.now() + 10 * 86400000),
      },
    });
    await prisma.projectSpecialist.create({
      data: { projectId: p1.id, specialistId: spec1.id, role: "مطور", cost: 2500, status: "in_progress", internalDeliveryDate: new Date(Date.now() + 7 * 86400000) },
    });
    await prisma.payment.create({ data: { type: "client_in", amount: 2500, projectId: p1.id, clientId: client1.id, method: "تحويل بنكي" } });
    await prisma.payment.create({ data: { type: "specialist_out", amount: 1000, projectId: p1.id, specialistId: spec1.id, method: "تحويل بنكي" } });

    const p2 = await prisma.project.create({
      data: {
        projectNumber: "PRJ-0002",
        title: "بحث في التسويق الرقمي",
        serviceType: "research",
        clientId: client2.id,
        value: 3000,
        status: "completed",
        progress: 100,
        completedAt: new Date(),
        deliveryDate: new Date(Date.now() - 2 * 86400000),
      },
    });
    await prisma.projectSpecialist.create({
      data: { projectId: p2.id, specialistId: spec2.id, role: "باحث", cost: 1500, status: "completed" },
    });
    await prisma.payment.create({ data: { type: "client_in", amount: 3000, projectId: p2.id, clientId: client2.id } });
    await prisma.payment.create({ data: { type: "specialist_out", amount: 1500, projectId: p2.id, specialistId: spec2.id } });

    const p3 = await prisma.project.create({
      data: {
        projectNumber: "PRJ-0003",
        title: "عرض تقديمي عن الذكاء الاصطناعي",
        serviceType: "presentation",
        clientId: client3.id,
        value: 1200,
        status: "specialist_assigned",
        progress: 10,
        deliveryDate: new Date(Date.now() - 1 * 86400000), // متأخر
      },
    });
    await prisma.projectSpecialist.create({
      data: { projectId: p3.id, specialistId: spec1.id, role: "مصمم", cost: 600, status: "assigned" },
    });
    await prisma.payment.create({ data: { type: "client_in", amount: 400, projectId: p3.id, clientId: client3.id } });

    await prisma.expense.create({ data: { type: "أدوات وبرامج", amount: 200, note: "اشتراك برنامج تصميم", projectId: p1.id } });

    console.log("✅ تمت إضافة بيانات تجريبية");
  }

  // فرص بيعية تجريبية (خطوط الأنابيب) - مستقلة عن المشاريع
  if ((await prisma.lead.count()) === 0) {
    const salesUser = await prisma.user.findUnique({ where: { username: "sales" } });
    const sampleLeads = [
      { title: "مشروع تخرج - هندسة", clientName: "عبدالله الشمري", phone: "0501234567", source: "إعلان", value: 4500, stage: "new" },
      { title: "بحث ماجستير - إدارة", clientName: "ريم الدوسري", phone: "0537654321", source: "توصية", value: 8000, stage: "contacted" },
      { title: "تطبيق جوال", clientName: "شركة نماء", phone: "0551112222", source: "موقع الكتروني", value: 25000, stage: "proposal" },
      { title: "عرض تقديمي تسويقي", clientName: "خالد العنزي", phone: "0509998888", source: "إنستغرام", value: 1500, stage: "negotiation" },
      { title: "ترجمة كتاب", clientName: "منى السبيعي", phone: "0544443333", source: "توصية", value: 3000, stage: "won" },
    ];
    for (const l of sampleLeads) {
      await prisma.lead.create({ data: { ...l, ownerId: salesUser?.id } });
    }
    console.log("✅ تمت إضافة فرص بيعية تجريبية");
  }

  // المحاسبة: خزنة افتراضية + ترحيل الحركات الموجودة (idempotent)
  let treasury = await prisma.treasury.findFirst({ where: { isDefault: true } });
  if (!treasury) treasury = await prisma.treasury.findFirst({ orderBy: { id: "asc" } });
  if (!treasury) {
    treasury = await prisma.treasury.create({ data: { name: "الخزنة الرئيسية", type: "cash", isDefault: true } });
    console.log("✅ تم إنشاء الخزنة الرئيسية");
  }

  // ترحيل دفعات العملاء/المختصين التي ليس لها حركة خزنة
  const payments = await prisma.payment.findMany({
    include: { project: { select: { projectNumber: true } }, client: { select: { name: true } }, specialist: { select: { name: true } } },
  });
  let backfilled = 0;
  for (const p of payments) {
    const exists = await prisma.transaction.findFirst({ where: { paymentId: p.id } });
    if (exists) continue;
    const isIn = p.type === "client_in";
    await prisma.transaction.create({
      data: {
        treasuryId: treasury.id,
        direction: isIn ? "in" : "out",
        category: isIn ? "client_payment" : "specialist_payment",
        counterAccount: isIn ? "إيرادات العملاء" : "مستحقات المختصين",
        amount: p.amount,
        date: p.date,
        description: isIn
          ? `دفعة عميل - ${p.project?.projectNumber || ""} - ${p.client?.name || ""}`
          : `دفعة لمختص - ${p.specialist?.name || ""} - ${p.project?.projectNumber || ""}`,
        projectId: p.projectId,
        clientId: p.clientId,
        specialistId: p.specialistId,
        paymentId: p.id,
        createdById: p.createdById,
      },
    });
    backfilled++;
  }
  // ترحيل المصروفات
  const expenses = await prisma.expense.findMany();
  for (const e of expenses) {
    const exists = await prisma.transaction.findFirst({ where: { expenseId: e.id } });
    if (exists) continue;
    await prisma.transaction.create({
      data: {
        treasuryId: treasury.id,
        direction: "out",
        category: "expense",
        counterAccount: "مصروفات تشغيلية",
        amount: e.amount,
        date: e.date,
        description: `مصروف${e.type ? " - " + e.type : ""}${e.note ? " - " + e.note : ""}`,
        projectId: e.projectId,
        expenseId: e.id,
        createdById: e.createdById,
      },
    });
    backfilled++;
  }
  if (backfilled > 0) console.log(`✅ تم ترحيل ${backfilled} حركة إلى الخزنة`);

  console.log("✅ اكتملت التهيئة");
  console.log("بيانات الدخول: admin / 123456 (وكذلك manager, service, accountant, specialist بكلمة 123456)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
