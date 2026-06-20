// تعريف الوحدات والإجراءات والصلاحيات الافتراضية لكل دور

export const MODULES = [
  "dashboard",
  "projects",
  "clients",
  "specialists",
  "financial",
  "accounting",
  "reports",
  "pipeline",
  "users",
  "settings",
] as const;

export type ModuleName = (typeof MODULES)[number];
export type ActionName = "view" | "create" | "edit" | "delete";

export interface ModulePerm {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface PermissionSet {
  modules: Record<ModuleName, ModulePerm>;
  flags: {
    viewProfits: boolean; // رؤية الأرباح
    viewSpecialistCosts: boolean; // رؤية تكاليف المختصين
    onlyAssignedProjects: boolean; // يرى فقط المشاريع المرتبطة به (مختص)
    manageBackups: boolean;
  };
}

const full = (): ModulePerm => ({ view: true, create: true, edit: true, delete: true });
const viewOnly = (): ModulePerm => ({ view: true, create: false, edit: false, delete: false });
const none = (): ModulePerm => ({ view: false, create: false, edit: false, delete: false });
const crud = (c: boolean, e: boolean, d: boolean): ModulePerm => ({
  view: true,
  create: c,
  edit: e,
  delete: d,
});

function buildModules(overrides: Partial<Record<ModuleName, ModulePerm>>, base: ModulePerm): PermissionSet["modules"] {
  const mods = {} as Record<ModuleName, ModulePerm>;
  for (const m of MODULES) mods[m] = { ...base };
  for (const k of Object.keys(overrides) as ModuleName[]) mods[k] = overrides[k]!;
  return mods;
}

// مدير النظام - كل الصلاحيات
export const ADMIN_PERMS: PermissionSet = {
  modules: buildModules({}, full()),
  flags: { viewProfits: true, viewSpecialistCosts: true, onlyAssignedProjects: false, manageBackups: true },
};

// مدير المشاريع - إدارة المشاريع والعملاء والمختصين ومتابعة كل شيء عدا الإعدادات والمستخدمين
export const PROJECT_MANAGER_PERMS: PermissionSet = {
  modules: buildModules(
    {
      dashboard: viewOnly(),
      projects: full(),
      clients: full(),
      specialists: full(),
      financial: crud(true, true, false),
      accounting: viewOnly(),
      reports: viewOnly(),
      pipeline: viewOnly(),
      users: none(),
      settings: none(),
    },
    none()
  ),
  flags: { viewProfits: true, viewSpecialistCosts: true, onlyAssignedProjects: false, manageBackups: false },
};

// فريق المبيعات - خطوط الأنابيب والعملاء
export const SALES_PERMS: PermissionSet = {
  modules: buildModules(
    {
      dashboard: viewOnly(),
      projects: viewOnly(),
      clients: crud(true, true, false),
      specialists: none(),
      financial: none(),
      reports: viewOnly(),
      pipeline: full(),
      users: none(),
      settings: none(),
    },
    none()
  ),
  flags: { viewProfits: false, viewSpecialistCosts: false, onlyAssignedProjects: false, manageBackups: false },
};

// خدمة العملاء - العملاء والمشاريع وإضافة الملاحظات بدون رؤية التكاليف والأرباح
export const CLIENT_SERVICE_PERMS: PermissionSet = {
  modules: buildModules(
    {
      dashboard: viewOnly(),
      projects: crud(true, true, false),
      clients: full(),
      specialists: viewOnly(),
      financial: none(),
      reports: viewOnly(),
      users: none(),
      settings: none(),
    },
    none()
  ),
  flags: { viewProfits: false, viewSpecialistCosts: false, onlyAssignedProjects: false, manageBackups: false },
};

// المحاسب - المالية والدفعات والتقارير المالية بدون تعديل المشاريع
export const ACCOUNTANT_PERMS: PermissionSet = {
  modules: buildModules(
    {
      dashboard: viewOnly(),
      projects: viewOnly(),
      clients: viewOnly(),
      specialists: viewOnly(),
      financial: full(),
      accounting: full(),
      reports: viewOnly(),
      users: none(),
      settings: none(),
    },
    none()
  ),
  flags: { viewProfits: true, viewSpecialistCosts: true, onlyAssignedProjects: false, manageBackups: false },
};

// المختص - يرى فقط مهامه ومشاريعه المرتبطة، يرفع ملفات ويضيف ملاحظات
export const SPECIALIST_PERMS: PermissionSet = {
  modules: buildModules(
    {
      dashboard: viewOnly(),
      projects: crud(false, true, false),
      clients: none(),
      specialists: none(),
      financial: none(),
      reports: none(),
      users: none(),
      settings: none(),
    },
    none()
  ),
  flags: { viewProfits: false, viewSpecialistCosts: false, onlyAssignedProjects: true, manageBackups: false },
};

export const DEFAULT_ROLES: {
  name: string;
  nameAr: string;
  description: string;
  permissions: PermissionSet;
  isSystem: boolean;
}[] = [
  { name: "admin", nameAr: "مدير النظام", description: "كل الصلاحيات", permissions: ADMIN_PERMS, isSystem: true },
  {
    name: "project_manager",
    nameAr: "مدير المشاريع",
    description: "إدارة المشاريع والعملاء والمختصين",
    permissions: PROJECT_MANAGER_PERMS,
    isSystem: true,
  },
  {
    name: "client_service",
    nameAr: "خدمة العملاء",
    description: "إدارة العملاء والمشاريع",
    permissions: CLIENT_SERVICE_PERMS,
    isSystem: true,
  },
  { name: "accountant", nameAr: "المحاسب", description: "الإدارة المالية", permissions: ACCOUNTANT_PERMS, isSystem: true },
  { name: "sales", nameAr: "مندوب المبيعات", description: "إدارة خطوط الأنابيب والفرص البيعية", permissions: SALES_PERMS, isSystem: true },
  { name: "specialist", nameAr: "المختص", description: "متابعة المهام المسندة", permissions: SPECIALIST_PERMS, isSystem: true },
];

export function emptyPermissions(): PermissionSet {
  return {
    modules: buildModules({}, none()),
    flags: { viewProfits: false, viewSpecialistCosts: false, onlyAssignedProjects: false, manageBackups: false },
  };
}

export function parsePermissions(raw: string | null | undefined): PermissionSet {
  if (!raw) return emptyPermissions();
  try {
    const parsed = JSON.parse(raw) as PermissionSet;
    const base = emptyPermissions();
    return {
      modules: { ...base.modules, ...(parsed.modules || {}) },
      flags: { ...base.flags, ...(parsed.flags || {}) },
    };
  } catch {
    return emptyPermissions();
  }
}
