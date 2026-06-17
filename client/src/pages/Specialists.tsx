import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, EmptyState, Modal, Field } from "../components/ui";
import { Icon } from "../components/Icon";
import { money } from "../lib/format";

export default function Specialists() {
  const { can, flag } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/specialists", { params: search ? { search } : {} })
      .then((res) => setList(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="المختصون"
        subtitle="إدارة المختصين ومستحقاتهم"
        icon="specialists"
        actions={can("specialists", "create") && <button className="btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={18} /> مختص جديد</button>}
      />
      <Card className="mb-4">
        <div className="flex gap-2 max-w-md">
          <input className="input" placeholder="بحث بالاسم، الهاتف، التخصص" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={load}>بحث</button>
        </div>
      </Card>
      <Card>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState message="لا يوجد مختصون" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>التخصص</th>
                  <th>الخبرة</th>
                  <th>المهام</th>
                  {flag("viewSpecialistCosts") && <th>إجمالي التكلفة</th>}
                  {flag("viewSpecialistCosts") && <th>المتبقي له</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="text-brand-600 hover:underline font-medium" to={`/specialists/${s.id}`}>{s.name}</Link>
                    </td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.specialization || "—"}</td>
                    <td>{s.experienceLevel || "—"}</td>
                    <td>{s.tasksCount}</td>
                    {flag("viewSpecialistCosts") && <td>{money(s.totalCost)}</td>}
                    {flag("viewSpecialistCosts") && <td className={s.totalDue > 0 ? "text-red-600" : ""}>{money(s.totalDue)}</td>}
                    <td className="text-left">
                      {can("specialists", "edit") && (
                        <button className="text-slate-500 text-xs hover:underline" onClick={() => setEdit(s)}>تعديل</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(showAdd || edit) && (
        <SpecialistModal
          specialist={edit}
          onClose={() => { setShowAdd(false); setEdit(null); }}
          onSaved={() => { setShowAdd(false); setEdit(null); load(); }}
        />
      )}
    </div>
  );
}

function SpecialistModal({ specialist, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: specialist?.name || "",
    phone: specialist?.phone || "",
    email: specialist?.email || "",
    specialization: specialist?.specialization || "",
    skills: specialist?.skills || "",
    experienceLevel: specialist?.experienceLevel || "",
    paymentMethod: specialist?.paymentMethod || "",
    status: specialist?.status || "active",
    notes: specialist?.notes || "",
  });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      if (specialist) await api.put(`/specialists/${specialist.id}`, form);
      else await api.post("/specialists", form);
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={specialist ? "تعديل مختص" : "مختص جديد"}>
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
        <Field label="التخصص">
          <input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
        </Field>
        <Field label="المهارات">
          <input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
        </Field>
        <Field label="مستوى الخبرة">
          <input className="input" value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <input className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} />
        </Field>
        <Field label="الحالة">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="ملاحظات">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
