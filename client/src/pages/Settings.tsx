import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, Field, Modal, Badge } from "../components/ui";
import { clearLookupCache } from "../lib/useLookups";

const CATEGORIES = [
  { key: "service_type", label: "أنواع الخدمات" },
  { key: "specialization", label: "التخصصات" },
  { key: "skill", label: "المهارات" },
  { key: "experience_level", label: "مستويات الخبرة" },
  { key: "payment_method", label: "طرق الدفع" },
  { key: "expense_type", label: "أنواع المصروفات" },
];

export default function Settings() {
  const { flag } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [lookups, setLookups] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [addCat, setAddCat] = useState<string | null>(null);

  const loadLookups = () => api.get("/lookups").then((r) => setLookups(r.data));
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data));
    loadLookups();
  }, []);

  if (!settings) return <Spinner />;

  const saveOrg = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/settings/org", { value: settings.org });
      await api.put("/settings/notifications", { value: settings.notifications });
      setMsg("تم حفظ الإعدادات");
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteLookup = async (id: number) => {
    if (!confirm("حذف العنصر؟")) return;
    await api.delete(`/lookups/${id}`);
    clearLookupCache();
    loadLookups();
  };

  const downloadBackup = async () => {
    const res = await api.get("/settings/backup/export", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إعدادات المؤسسة والقوائم والنظام" icon="settings" />

      {msg && <div className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">{msg}</div>}

      <Card className="mb-4">
        <h3 className="font-bold text-slate-800 mb-3">إعدادات المؤسسة</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="اسم المؤسسة"><input className="input" value={settings.org.name || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, name: e.target.value } })} /></Field>
          <Field label="العملة"><input className="input" value={settings.org.currency || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, currency: e.target.value } })} /></Field>
          <Field label="الهاتف"><input className="input" value={settings.org.phone || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, phone: e.target.value } })} /></Field>
          <Field label="البريد"><input className="input" value={settings.org.email || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, email: e.target.value } })} /></Field>
          <div className="md:col-span-2"><Field label="العنوان"><input className="input" value={settings.org.address || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, address: e.target.value } })} /></Field></div>
        </div>
        <div className="mt-4">
          <h4 className="font-medium text-slate-700 mb-2">الإشعارات</h4>
          <div className="flex flex-wrap gap-4">
            {[
              ["projectCreated", "إنشاء مشروع"],
              ["taskAssigned", "تعيين مهمة"],
              ["nearDelivery", "قرب موعد التسليم"],
              ["newNote", "ملاحظة جديدة"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!settings.notifications?.[k]} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, [k]: e.target.checked } })} className="h-4 w-4" />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary" onClick={saveOrg} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="font-bold text-slate-800 mb-3">القوائم القابلة للإعداد</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700">{cat.label}</span>
                <button className="text-brand-600 text-xs hover:underline" onClick={() => setAddCat(cat.key)}>+ إضافة</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lookups.filter((l) => l.category === cat.key).map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    {l.label}
                    <button className="text-red-400 hover:text-red-600" onClick={() => deleteLookup(l.id)}>✕</button>
                  </span>
                ))}
                {lookups.filter((l) => l.category === cat.key).length === 0 && <span className="text-xs text-slate-400">لا عناصر</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {flag("manageBackups") && (
        <Card>
          <h3 className="font-bold text-slate-800 mb-2">النسخ الاحتياطي</h3>
          <p className="text-sm text-slate-500 mb-3">تنزيل نسخة احتياطية من بيانات النظام بصيغة JSON.</p>
          <button className="btn-secondary" onClick={downloadBackup}>تنزيل نسخة احتياطية</button>
        </Card>
      )}

      {addCat && <AddLookupModal category={addCat} onClose={() => setAddCat(null)} onSaved={() => { setAddCat(null); clearLookupCache(); loadLookups(); }} />}
    </div>
  );
}

function AddLookupModal({ category, onClose, onSaved }: any) {
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      const value = label.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Date.now().toString(36);
      await api.post("/lookups", { category, value, label });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="إضافة عنصر" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="الاسم" required>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save} disabled={!label.trim()}>حفظ</button>
      </div>
    </Modal>
  );
}
