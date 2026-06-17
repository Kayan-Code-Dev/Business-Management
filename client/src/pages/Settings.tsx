import { useEffect, useRef, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, Field, Modal, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { clearLookupCache } from "../lib/useLookups";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/toast";

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
  const { refresh } = useSettings();
  const { notify } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [lookups, setLookups] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [addCat, setAddCat] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const loadLookups = () => api.get("/lookups").then((r) => setLookups(r.data));
  useEffect(() => {
    api.get("/settings").then((r) =>
      setSettings({
        org: { name: "", phone: "", email: "", address: "", logo: "", currency: "ر.س", taxNumber: "", ...(r.data.org || {}) },
        notifications: r.data.notifications || {},
        invoice: { defaultTaxRate: 0, terms: "", ...(r.data.invoice || {}) },
      })
    );
    loadLookups();
  }, []);

  if (!settings) return <Spinner />;

  const onLogo = (file: File | null) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      notify("حجم الشعار كبير (الحد 1.5 ميجابايت)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSettings((s: any) => ({ ...s, org: { ...s.org, logo: reader.result as string } }));
    reader.readAsDataURL(file);
  };

  const saveOrg = async () => {
    setSaving(true);
    try {
      await api.put("/settings/org", { value: settings.org });
      await api.put("/settings/notifications", { value: settings.notifications });
      await api.put("/settings/invoice", { value: settings.invoice });
      await refresh();
      notify("تم حفظ الإعدادات وتطبيقها على النظام");
    } catch (e) {
      notify(apiError(e), "error");
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

      <Card className="mb-4">
        <h3 className="font-bold text-ink-800 mb-4">إعدادات المؤسسة</h3>

        {/* Logo */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-ink-100">
          <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 flex items-center justify-center overflow-hidden shrink-0">
            {settings.org.logo ? (
              <img src={settings.org.logo} alt="logo" className="h-full w-full object-contain" />
            ) : (
              <Icon name="building" size={28} className="text-ink-300" />
            )}
          </div>
          <div>
            <div className="font-semibold text-ink-700 mb-1">شعار الشركة</div>
            <p className="text-xs text-ink-400 mb-2">يظهر في القائمة الجانبية وعلى الفواتير (PNG/JPG حتى 1.5MB)</p>
            <div className="flex gap-2">
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
              <button className="btn-secondary btn-sm" onClick={() => logoInput.current?.click()}>
                <Icon name="upload" size={15} /> رفع شعار
              </button>
              {settings.org.logo && (
                <button className="btn-ghost btn-sm text-red-500" onClick={() => setSettings({ ...settings, org: { ...settings.org, logo: "" } })}>
                  إزالة
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="اسم المؤسسة"><input className="input" value={settings.org.name || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, name: e.target.value } })} /></Field>
          <Field label="العملة" hint="مثال: ر.س، $، د.أ"><input className="input" value={settings.org.currency || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, currency: e.target.value } })} /></Field>
          <Field label="الهاتف"><input className="input" value={settings.org.phone || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, phone: e.target.value } })} /></Field>
          <Field label="البريد"><input className="input" value={settings.org.email || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, email: e.target.value } })} /></Field>
          <Field label="الرقم الضريبي"><input className="input" value={settings.org.taxNumber || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, taxNumber: e.target.value } })} /></Field>
          <Field label="العنوان"><input className="input" value={settings.org.address || ""} onChange={(e) => setSettings({ ...settings, org: { ...settings.org, address: e.target.value } })} /></Field>
        </div>

        {/* Invoice settings */}
        <div className="mt-5 pt-5 border-t border-ink-100">
          <h4 className="font-semibold text-ink-700 mb-3">إعدادات الفاتورة</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="نسبة الضريبة الافتراضية (%)">
              <input type="number" className="input" value={settings.invoice.defaultTaxRate ?? 0} onChange={(e) => setSettings({ ...settings, invoice: { ...settings.invoice, defaultTaxRate: Number(e.target.value) } })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="الشروط / ملاحظات الفاتورة">
                <textarea className="input" rows={2} value={settings.invoice.terms || ""} onChange={(e) => setSettings({ ...settings, invoice: { ...settings.invoice, terms: e.target.value } })} placeholder="مثال: تُدفع الفاتورة خلال 15 يوماً من تاريخ الإصدار" />
              </Field>
            </div>
          </div>
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
