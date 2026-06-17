import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Icon, IconName } from "./Icon";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  module?: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: "dashboard", module: "dashboard" },
  { to: "/projects", label: "المشاريع", icon: "projects", module: "projects" },
  { to: "/clients", label: "العملاء", icon: "clients", module: "clients" },
  { to: "/specialists", label: "المختصون", icon: "specialists", module: "specialists" },
  { to: "/financial", label: "المالية", icon: "financial", module: "financial" },
  { to: "/reports", label: "التقارير", icon: "reports", module: "reports" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/users", label: "المستخدمون والأدوار", icon: "users", module: "users" },
  { to: "/settings", label: "الإعدادات", icon: "settings", module: "settings" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    api.get("/settings").then((r) => setOrg(r.data?.org)).catch(() => {});
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);

  const mainItems = NAV.filter((n) => !n.module || can(n.module, "view"));
  const adminItems = ADMIN_NAV.filter((n) => !n.module || can(n.module, "view"));
  const showActivity = can("settings", "view") || can("users", "view");

  const renderLink = (n: NavItem) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.to === "/"}
      className={({ isActive }) =>
        `nav-link group ${
          isActive
            ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_#a5b4fc] font-semibold"
            : "text-indigo-200/80 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`${isActive ? "text-brand-300" : "text-indigo-300/70 group-hover:text-brand-200"}`}>
            <Icon name={n.icon} size={19} />
          </span>
          {n.label}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex bg-ink-100 bg-mesh">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen z-40 w-72 bg-sidebar-gradient text-white transform transition-transform duration-300 no-print right-0 ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Icon name="briefcase" size={22} className="text-brand-200" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px] leading-tight truncate">{org?.name || "إدارة المشاريع"}</div>
            <div className="text-[11px] text-indigo-300/70">نظام إدارة احترافي</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300/50">القائمة الرئيسية</div>
          {mainItems.map(renderLink)}

          {(adminItems.length > 0 || showActivity) && (
            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300/50">الإدارة</div>
          )}
          {adminItems.map(renderLink)}
          {showActivity && renderLink({ to: "/activity", label: "سجل النشاطات", icon: "activity" })}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 bg-ink-950/40 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-ink-200/70 flex items-center justify-between px-4 lg:px-7 no-print sticky top-0 z-20">
          <button className="lg:hidden btn-ghost px-2" onClick={() => setOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end leading-tight ml-1">
              <span className="text-sm font-semibold text-ink-800">{user?.name}</span>
              <span className="text-[11px] text-brand-600 font-medium">{user?.roleNameAr}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-bold shadow-soft">
              {user?.name?.charAt(0)}
            </div>
            <button onClick={logout} className="btn-ghost px-2.5" title="تسجيل الخروج">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-7 overflow-x-hidden max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
