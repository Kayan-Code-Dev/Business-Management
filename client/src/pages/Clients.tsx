import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, EmptyState, Modal, Field } from "../components/ui";
import { money } from "../lib/format";

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
        actions={
          can("clients", "create") && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + عميل جديد
            </button>
          )
        }
      />
      <Card className="mb-4">
        <div className="flex gap-2 max-w-md">
          <input
            className="input"
            placeholder="بحث بالاسم أو الهاتف"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn-secondary" onClick={load}>بحث</button>
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
                  <th>الهاتف</th>
                  <th>الدولة</th>
                  <th>التخصص</th>
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
                    <td>{c.phone || "—"}</td>
                    <td>{c.country || "—"}</td>
                    <td>{c.specialization || "—"}</td>
                    <td>{c.projectsCount}</td>
                    <td className="text-green-600">{money(c.totalPaid)}</td>
                    <td className={c.totalRemaining > 0 ? "text-red-600" : ""}>{money(c.totalRemaining)}</td>
                    <td className="text-left">
                      {can("clients", "edit") && (
                        <button className="text-slate-500 text-xs hover:underline" onClick={() => setEdit(c)}>
                          تعديل
                        </button>
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
    country: client?.country || "",
    specialization: client?.specialization || "",
    notes: client?.notes || "",
  });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      if (client) await api.put(`/clients/${client.id}`, form);
      else await api.post("/clients", form);
      onSaved();
    } catch (e) {
      setErr(apiError(e));
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
        <Field label="الدولة">
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Field>
        <Field label="التخصص">
          <input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
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
