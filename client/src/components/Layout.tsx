import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  module?: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: "🏠", module: "dashboard" },
  { to: "/projects", label: "المشاريع", icon: "📁", module: "projects" },
  { to: "/clients", label: "العملاء", icon: "👥", module: "clients" },
  { to: "/specialists", label: "المختصون", icon: "🧑‍💻", module: "specialists" },
  { to: "/financial", label: "المالية", icon: "💰", module: "financial" },
  { to: "/reports", label: "التقارير", icon: "📊", module: "reports" },
  { to: "/users", label: "المستخدمون والأدوار", icon: "🔐", module: "users" },
  { to: "/settings", label: "الإعدادات", icon: "⚙️", module: "settings" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.module || can(n.module, "view"));
  const showActivity = can("settings", "view") || can("users", "view");

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-brand-800 text-white transform transition-transform no-print ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-brand-700">
          <span className="text-2xl">📚</span>
          <span className="font-bold text-lg">إدارة المشاريع</span>
        </div>
        <nav className="p-3 space-y-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? "bg-brand-600 text-white font-medium" : "text-brand-100 hover:bg-brand-700"
                }`
              }
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          {showActivity && (
            <NavLink
              to="/activity"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? "bg-brand-600 text-white font-medium" : "text-brand-100 hover:bg-brand-700"
                }`
              }
            >
              <span className="text-lg">📝</span>
              سجل النشاطات
            </NavLink>
          )}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 no-print sticky top-0 z-20">
          <button className="lg:hidden btn-ghost px-2" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-700">{user?.name}</div>
              <div className="text-xs text-slate-400">{user?.roleNameAr}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              {user?.name?.charAt(0)}
            </div>
            <button onClick={logout} className="btn-secondary text-xs px-3 py-1.5">
              خروج
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
