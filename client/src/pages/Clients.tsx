import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, EmptyState, Modal, Field, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate } from "../lib/format";

const SOURCE_LABELS: Record<string, string> = {
  facebook: "فيسبوك",
  instagram: "إنستغرام",
  whatsapp: "واتساب",
  website: "موقع إلكتروني",
  referral: "توصية",
  other: "أخرى",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "عميل نشط", color: "bg-emerald-50 text-emerald-700" },
  potential: { label: "عميل محتمل", color: "bg-amber-50 text-amber-700" },
  inactive: { label: "عميل متوقف", color: "bg-slate-100 text-slate-700" },
};

export default function Clients() {
  const { can } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/clients", { params: search ? { search } : {} })
      .then((res) => setClients(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="العملاء"
        subtitle="إدارة العملاء وأرصدتهم"
        icon="clients"
        actions={
          can("clients", "create") && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={18} /> عميل جديد
            </button>
          )
        }
      />
      <Card className="mb-4">
        <div className="flex gap-2 max-w-md">
          <input
            className="input"
            placeholder="بحث بالاسم أو الهاتف أو البريد"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn-secondary" onClick={load}>
            بحث
          </button>
        </div>
      </Card>
      <Card>
        {loading ? (
          <Spinner />
        ) : clients.length === 0 ? (
          <EmptyState message="لا يوجد عملاء" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الحالة</th>
                  <th>المصدر</th>
                  <th>الهاتف</th>
                  <th>الدولة</th>
                  <th>آخر مشروع</th>
                  <th>تاريخ آخر تعامل</th>
                  <th>المشاريع</th>
                  <th>إجمالي المدفوع</th>
                  <th>المتبقي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="text-brand-600 hover:underline font-medium" to={`/clients/${c.id}`}>
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <Badge color={STATUS_META[c.status]?.color || "bg-ink-100 text-ink-700"}>
                        {STATUS_META[c.status]?.label || c.status}
                      </Badge>
                    </td>
                    <td>{SOURCE_LABELS[c.source] || c.source || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.country || "—"}</td>
                    <td className="max-w-[180px] truncate">
                      {c.lastProjectNumber ? `${c.lastProjectNumber} · ${c.lastProjectTitle || ""}` : "—"}
                    </td>
                    <td>{formatDate(c.lastInteractionDate)}</td>
                    <td>{c.projectsCount}</td>
                    <td className="text-green-600">{money(c.totalPaid)}</td>
                    <td className={c.totalRemaining > 0 ? "text-red-600" : ""}>{money(c.totalRemaining)}</td>
                    <td className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <Link className="btn-secondary btn-sm" to={`/clients/${c.id}`}>
                          <Icon name="eye" size={14} /> عرض الملف
                        </Link>
                        {can("clients", "edit") && (
                          <button className="text-slate-500 text-xs hover:underline" onClick={() => setEdit(c)}>
                            تعديل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(showAdd || edit) && (
        <ClientModal
          client={edit}
          onClose={() => {
            setShowAdd(false);
            setEdit(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ClientModal({ client, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: client?.name || "",
    phone: client?.phone || "",
    email: client?.email || "",
    country: client?.country || "",
    university: client?.university || "",
    academicDegree: client?.academicDegree || "",
    source: client?.source || "",
    status: client?.status || "active",
    specialization: client?.specialization || "",
    notes: client?.notes || "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const uploadInitialFiles = async (clientId: number) => {
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("name", f.name);
      await api.post(`/clients/${clientId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    }
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      if (client) {
        await api.put(`/clients/${client.id}`, form);
      } else {
        const res = await api.post("/clients", form);
        if (files.length) await uploadInitialFiles(res.data.id);
      }
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={client ? "تعديل عميل" : "عميل جديد"}>
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="الاسم" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="الهاتف">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="البريد الإلكتروني">
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="الدولة">
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Field>
        <Field label="الجامعة">
          <input className="input" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
        </Field>
        <Field label="الدرجة العلمية">
          <select className="input" value={form.academicDegree} onChange={(e) => setForm({ ...form, academicDegree: e.target.value })}>
            <option value="">اختر</option>
            <option value="bachelor">بكالوريوس</option>
            <option value="master">ماجستير</option>
            <option value="phd">دكتوراه</option>
          </select>
        </Field>
        <Field label="مصدر العميل">
          <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="">اختر</option>
            <option value="facebook">فيسبوك</option>
            <option value="instagram">إنستغرام</option>
            <option value="whatsapp">واتساب</option>
            <option value="website">موقع إلكتروني</option>
            <option value="referral">توصية</option>
            <option value="other">أخرى</option>
          </select>
        </Field>
        <Field label="حالة العميل">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">عميل نشط</option>
            <option value="potential">عميل محتمل</option>
            <option value="inactive">عميل متوقف</option>
          </select>
        </Field>
        <Field label="التخصص">
          <input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="ملاحظات">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        {!client && (
          <div className="md:col-span-2">
            <Field label="مرفقات العميل">
              <input type="file" className="input" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </Field>
            {files.length > 0 && <p className="text-xs text-ink-500 mt-1">سيتم رفع {files.length} ملف بعد إنشاء العميل.</p>}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}
