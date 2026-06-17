import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, EmptyState, Modal, Field, Badge, TableSkeleton } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate } from "../lib/format";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/toast";

export const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-ink-100 text-ink-600" },
  sent: { label: "مُرسلة", color: "bg-blue-50 text-blue-700" },
  paid: { label: "مدفوعة", color: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "ملغاة", color: "bg-red-50 text-red-700" },
};

export default function Invoices() {
  const { can } = useAuth();
  const { notify } = useToast();
  const [params] = useSearchParams();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState<any>(null);

  const load = () => {
    setLoading(true);
    const p: any = {};
    if (search) p.search = search;
    if (status !== "all") p.status = status;
    api.get("/invoices", { params: p }).then((r) => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  // فتح مودال الإنشاء تلقائياً عند القدوم من مشروع (?projectId=)
  useEffect(() => {
    if (params.get("projectId") && can("financial", "create")) {
      setModal({ mode: "create", projectId: params.get("projectId") });
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="الفواتير"
        subtitle="إنشاء وإدارة فواتير العملاء"
        icon="file"
        actions={can("financial", "create") && <button className="btn-primary" onClick={() => setModal({ mode: "create" })}><Icon name="plus" size={18} /> فاتورة جديدة</button>}
      />

      <Card className="mb-5 !p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"><Icon name="search" size={18} /></span>
            <input className="input pr-10" placeholder="بحث برقم الفاتورة أو اسم العميل" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">كل الحالات</option>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="p-5"><TableSkeleton rows={6} cols={6} /></div>
        ) : list.length === 0 ? (
          <EmptyState message="لا توجد فواتير" icon="file" action={can("financial", "create") && <button className="btn-primary" onClick={() => setModal({ mode: "create" })}><Icon name="plus" size={18} /> أنشئ أول فاتورة</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>رقم الفاتورة</th><th>العميل</th><th>المشروع</th><th>تاريخ الإصدار</th><th>الاستحقاق</th><th>الإجمالي</th><th>الحالة</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-bold">{inv.invoiceNumber}</Link></td>
                    <td className="font-medium text-ink-800">{inv.client?.name}</td>
                    <td className="text-sm text-ink-500">{inv.project?.projectNumber || "—"}</td>
                    <td className="text-sm">{formatDate(inv.issueDate)}</td>
                    <td className="text-sm">{formatDate(inv.dueDate)}</td>
                    <td className="font-bold">{money(inv.total)}</td>
                    <td><Badge color={INVOICE_STATUS[inv.status]?.color}>{INVOICE_STATUS[inv.status]?.label}</Badge></td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={`/invoices/${inv.id}`} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-brand-600" title="عرض"><Icon name="eye" size={16} /></Link>
                        {can("financial", "edit") && <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-brand-600" onClick={() => setModal({ mode: "edit", id: inv.id })} title="تعديل"><Icon name="edit" size={16} /></button>}
                        {can("financial", "delete") && <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={async () => { if (confirm("حذف الفاتورة؟")) { await api.delete(`/invoices/${inv.id}`); notify("تم الحذف"); load(); } }} title="حذف"><Icon name="trash" size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <InvoiceModal
          mode={modal.mode}
          id={modal.id}
          prefillProjectId={modal.projectId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); notify(modal.mode === "edit" ? "تم حفظ الفاتورة" : "تم إنشاء الفاتورة"); load(); }}
        />
      )}
    </div>
  );
}

function InvoiceModal({ mode, id, prefillProjectId, onClose, onSaved }: any) {
  const { invoice: invoiceSettings } = useSettings();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    clientId: "",
    projectId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "draft",
    discount: 0,
    taxRate: invoiceSettings.defaultTaxRate || 0,
    notes: invoiceSettings.terms || "",
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(mode !== "edit");

  useEffect(() => {
    api.get("/clients").then((r) => setClients(r.data)).catch(() => {});
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
    if (mode === "edit" && id) {
      api.get(`/invoices/${id}`).then((r) => {
        const inv = r.data;
        setForm({
          clientId: inv.clientId,
          projectId: inv.projectId || "",
          issueDate: inv.issueDate?.slice(0, 10),
          dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
          status: inv.status,
          discount: inv.discount,
          taxRate: inv.taxRate,
          notes: inv.notes || "",
          items: inv.items.length ? inv.items.map((it: any) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice })) : [{ description: "", quantity: 1, unitPrice: 0 }],
        });
        setReady(true);
      });
    }
  }, []);

  // عند اختيار مشروع: تعبئة العميل وبند من قيمة المشروع
  const onProjectChange = (pid: string) => {
    const p = projects.find((x) => String(x.id) === String(pid));
    if (p) {
      setForm((f: any) => ({
        ...f,
        projectId: pid,
        clientId: p.client?.id || f.clientId,
        items: [{ description: `${p.title}${p.projectNumber ? " - " + p.projectNumber : ""}`, quantity: 1, unitPrice: p.value || 0 }],
      }));
    } else {
      setForm((f: any) => ({ ...f, projectId: pid }));
    }
  };

  useEffect(() => {
    if (prefillProjectId && projects.length) onProjectChange(String(prefillProjectId));
  }, [projects]);

  const setItem = (i: number, key: string, val: any) => {
    setForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => (idx === i ? { ...it, [key]: val } : it)) }));
  };
  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0 }] }));
  const removeItem = (i: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }));

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const taxable = Math.max(0, subtotal - (Number(form.discount) || 0));
    const taxAmount = (taxable * (Number(form.taxRate) || 0)) / 100;
    return { subtotal, taxAmount, total: taxable + taxAmount };
  }, [form.items, form.discount, form.taxRate]);

  const save = async (openAfter: boolean) => {
    setError("");
    if (!form.clientId) return setError("اختر العميل");
    if (!form.items.some((it: any) => it.description)) return setError("أضف بنداً واحداً على الأقل");
    setSaving(true);
    try {
      const payload = { ...form, projectId: form.projectId || null };
      const res = mode === "edit" ? await api.put(`/invoices/${id}`, payload) : await api.post("/invoices", payload);
      if (openAfter && res.data?.id) navigate(`/invoices/${res.data.id}`);
      else onSaved();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <Modal open onClose={onClose} title="تحميل..."><Spinner /></Modal>;

  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "تعديل الفاتورة" : "فاتورة جديدة"} size="xl">
      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      <div className="grid md:grid-cols-4 gap-4 mb-5">
        <Field label="العميل" required>
          <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">اختر العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="المشروع (اختياري)">
          <select className="input" value={form.projectId} onChange={(e) => onProjectChange(e.target.value)}>
            <option value="">بدون</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.projectNumber} - {p.title}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الإصدار"><input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></Field>
        <Field label="تاريخ الاستحقاق"><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label !mb-0">بنود الفاتورة</label>
          <button className="btn-secondary btn-sm" onClick={addItem}><Icon name="plus" size={15} /> إضافة بند</button>
        </div>
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-ink-400 px-1">
            <div className="col-span-6">الوصف</div>
            <div className="col-span-2">الكمية</div>
            <div className="col-span-2">سعر الوحدة</div>
            <div className="col-span-2">الإجمالي</div>
          </div>
          {form.items.map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="input col-span-12 md:col-span-6" placeholder="وصف البند" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
              <input type="number" className="input col-span-4 md:col-span-2" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
              <input type="number" className="input col-span-4 md:col-span-2" value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} />
              <div className="col-span-3 md:col-span-1 text-sm font-semibold text-ink-700">{money((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}</div>
              <button className="col-span-1 text-red-400 hover:text-red-600 flex justify-center" onClick={() => removeItem(i)} disabled={form.items.length === 1}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Field label="ملاحظات / شروط">
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="bg-ink-50 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">المجموع الفرعي</span>
            <span className="font-semibold">{money(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">الخصم</span>
            <input type="number" className="input !w-28 !py-1 text-left" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">الضريبة (%)</span>
            <input type="number" className="input !w-28 !py-1 text-left" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">قيمة الضريبة</span>
            <span className="font-semibold">{money(totals.taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-ink-200">
            <span className="font-bold text-ink-800">الإجمالي النهائي</span>
            <span className="text-xl font-extrabold text-brand-700">{money(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>حفظ</button>
        <button className="btn-primary" onClick={() => save(true)} disabled={saving}>{saving ? "..." : "حفظ وعرض الفاتورة"}</button>
      </div>
    </Modal>
  );
}
