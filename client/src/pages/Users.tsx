import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, EmptyState, Modal, Field, Badge } from "../components/ui";
import { formatDateTime } from "../lib/format";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  projects: "المشاريع",
  clients: "العملاء",
  specialists: "المختصون",
  financial: "المالية",
  reports: "التقارير",
  users: "المستخدمون",
  settings: "الإعدادات",
};
const ACTION_LABELS: Record<string, string> = { view: "عرض", create: "إضافة", edit: "تعديل", delete: "حذف" };

export default function Users() {
  const { can } = useAuth();
  const [tab, setTab] = useState("users");
  return (
    <div>
      <PageHeader title="المستخدمون والأدوار" subtitle="إدارة الحسابات والصلاحيات" />
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setTab("users")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "users" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>المستخدمون</button>
        <button onClick={() => setTab("roles")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "roles" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>الأدوار والصلاحيات</button>
      </div>
      {tab === "users" ? <UsersTab can={can} /> : <RolesTab can={can} />}
    </div>
  );
}

function UsersTab({ can }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [pwUser, setPwUser] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get("/users").then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get("/roles").then((r) => setRoles(r.data));
    api.get("/specialists").then((r) => setSpecialists(r.data)).catch(() => {});
  }, []);

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-slate-800">المستخدمون</h3>
        {can("users", "create") && <button className="btn-primary text-sm" onClick={() => setModal({})}>+ مستخدم</button>}
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.username}</td>
                  <td><Badge color="bg-brand-50 text-brand-700">{u.role?.nameAr}</Badge></td>
                  <td>
                    <Badge color={u.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}>
                      {u.isActive ? "نشط" : "معطّل"}
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                  <td className="text-left whitespace-nowrap">
                    {can("users", "edit") && <button className="text-slate-500 text-xs hover:underline ml-2" onClick={() => setModal(u)}>تعديل</button>}
                    {can("users", "edit") && <button className="text-slate-500 text-xs hover:underline ml-2" onClick={() => setPwUser(u)}>كلمة المرور</button>}
                    {can("users", "edit") && (
                      <button className="text-amber-600 text-xs hover:underline ml-2" onClick={async () => { await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive }); load(); }}>
                        {u.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    )}
                    {can("users", "delete") && <button className="text-red-500 text-xs hover:underline" onClick={async () => { if (confirm("حذف المستخدم؟")) { await api.delete(`/users/${u.id}`); load(); } }}>حذف</button>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6}><EmptyState message="لا يوجد مستخدمون" /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && <UserModal user={modal.id ? modal : null} roles={roles} specialists={specialists} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {pwUser && <PasswordModal user={pwUser} onClose={() => setPwUser(null)} />}
    </Card>
  );
}

function UserModal({ user, roles, specialists, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    roleId: user?.role?.id || "",
    specialistId: user?.specialist?.id || "",
  });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      if (user) await api.put(`/users/${user.id}`, form);
      else await api.post("/users", form);
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={user ? "تعديل مستخدم" : "مستخدم جديد"}>
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="الاسم" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="اسم المستخدم" required><input className="input" value={form.username} disabled={!!user} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label="البريد"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="الهاتف"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {!user && <Field label="كلمة المرور" required><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>}
        <Field label="الدور" required>
          <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">اختر</option>
            {roles.map((r: any) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
          </select>
        </Field>
        <Field label="ربط بمختص (للأدوار من نوع مختص)">
          <select className="input" value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value })}>
            <option value="">بدون</option>
            {specialists.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function PasswordModal({ user, onClose }: any) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const save = async () => {
    await api.patch(`/users/${user.id}/password`, { password });
    setMsg("تم تغيير كلمة المرور");
    setTimeout(onClose, 800);
  };
  return (
    <Modal open onClose={onClose} title={`كلمة مرور: ${user.name}`} size="sm">
      {msg && <div className="mb-3 text-green-600 text-sm">{msg}</div>}
      <Field label="كلمة المرور الجديدة" required>
        <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save} disabled={!password}>حفظ</button>
      </div>
    </Modal>
  );
}

function RolesTab({ can }: any) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/roles").then((r) => setRoles(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {roles.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800">{r.nameAr} {r.isSystem && <Badge color="bg-slate-100 text-slate-500">أساسي</Badge>}</h3>
              <p className="text-sm text-slate-500">{r.description} · {r.usersCount} مستخدم</p>
            </div>
            {can("users", "edit") && <button className="btn-secondary text-sm" onClick={() => setEdit(r)}>تعديل الصلاحيات</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(r.permissions.modules).map(([mod, p]: any) => {
              const actions = Object.entries(p).filter(([, v]) => v).map(([a]) => ACTION_LABELS[a]);
              if (actions.length === 0) return null;
              return (
                <span key={mod} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <span className="font-medium text-slate-700">{MODULE_LABELS[mod]}</span>: {actions.join("، ")}
                </span>
              );
            })}
          </div>
        </Card>
      ))}
      {edit && <RoleEditor role={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function RoleEditor({ role, onClose, onSaved }: any) {
  const [perms, setPerms] = useState(JSON.parse(JSON.stringify(role.permissions)));
  const [err, setErr] = useState("");
  const toggle = (mod: string, action: string) => {
    const copy = { ...perms, modules: { ...perms.modules } };
    copy.modules[mod] = { ...copy.modules[mod], [action]: !copy.modules[mod][action] };
    setPerms(copy);
  };
  const toggleFlag = (flag: string) => setPerms({ ...perms, flags: { ...perms.flags, [flag]: !perms.flags[flag] } });
  const save = async () => {
    try {
      await api.put(`/roles/${role.id}`, { permissions: perms });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={`صلاحيات: ${role.nameAr}`} size="lg">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>الوحدة</th>{["view", "create", "edit", "delete"].map((a) => <th key={a} className="text-center">{ACTION_LABELS[a]}</th>)}</tr>
          </thead>
          <tbody>
            {Object.keys(perms.modules).map((mod) => (
              <tr key={mod}>
                <td className="font-medium">{MODULE_LABELS[mod]}</td>
                {["view", "create", "edit", "delete"].map((a) => (
                  <td key={a} className="text-center">
                    <input type="checkbox" checked={perms.modules[mod][a]} onChange={() => toggle(mod, a)} className="h-4 w-4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-2">
        <div className="font-medium text-sm text-slate-700">صلاحيات خاصة:</div>
        {[
          ["viewProfits", "رؤية الأرباح"],
          ["viewSpecialistCosts", "رؤية تكاليف المختصين"],
          ["onlyAssignedProjects", "حصر العرض على المشاريع المرتبطة فقط (مختص)"],
          ["manageBackups", "إدارة النسخ الاحتياطي"],
        ].map(([f, label]) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={perms.flags[f]} onChange={() => toggleFlag(f)} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
