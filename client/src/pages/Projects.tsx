import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, StatusBadge, Progress, EmptyState, Modal, Field } from "../components/ui";
import { money, formatDate, PROJECT_STATUS_FLOW } from "../lib/format";
import { useLookups } from "../lib/useLookups";

export default function Projects() {
  const { can, flag } = useAuth();
  const { byCategory } = useLookups();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    if (serviceType !== "all") params.serviceType = serviceType;
    api
      .get("/projects", { params })
      .then((res) => setProjects(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status, serviceType]);

  useEffect(() => {
    if (can("clients", "view")) api.get("/clients").then((res) => setClients(res.data));
  }, []);

  const statuses = ["all", ...PROJECT_STATUS_FLOW, "late", "cancelled"];
  const statusLabels: Record<string, string> = {
    all: "كل الحالات",
    new: "جديد",
    specialist_assigned: "تم تعيين المختص",
    in_progress: "قيد التنفيذ",
    first_delivery: "التسليم الأول",
    revisions: "تعديلات",
    final_delivery: "التسليم النهائي",
    completed: "مكتمل",
    late: "متأخر",
    cancelled: "ملغي",
  };

  return (
    <div>
      <PageHeader
        title="المشاريع"
        subtitle="إدارة ومتابعة المشاريع"
        actions={
          can("projects", "create") && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + مشروع جديد
            </button>
          )
        }
      />

      <Card className="mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="بحث برقم المشروع، العنوان، العميل، المختص..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
              <button className="btn-secondary" onClick={load}>
                بحث
              </button>
            </div>
          </div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            <option value="all">كل الخدمات</option>
            {byCategory("service_type").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : projects.length === 0 ? (
          <EmptyState message="لا توجد مشاريع مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>المشروع</th>
                  <th>العميل</th>
                  <th>المختصون</th>
                  <th>الحالة</th>
                  <th>التسليم</th>
                  <th>التقدّم</th>
                  <th>القيمة</th>
                  <th>المتبقي</th>
                  {flag("viewProfits") && <th>الربح المتوقع</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="text-brand-600 hover:underline font-medium" to={`/projects/${p.id}`}>
                        {p.projectNumber}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate">{p.title}</td>
                    <td>{p.client?.name}</td>
                    <td className="text-xs text-slate-500">{p.specialists?.map((s: any) => s.name).join("، ") || "—"}</td>
                    <td>
                      <StatusBadge status={p.status} isLate={p.isLate} />
                    </td>
                    <td className="text-sm">{formatDate(p.deliveryDate)}</td>
                    <td>
                      <Progress value={p.progress} />
                    </td>
                    <td>{money(p.value)}</td>
                    <td className={p.clientRemaining > 0 ? "text-red-600" : "text-green-600"}>{money(p.clientRemaining)}</td>
                    {flag("viewProfits") && <td className="text-brand-700 font-medium">{money(p.expectedProfit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <AddProjectModal
          clients={clients}
          serviceTypes={byCategory("service_type")}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddProjectModal({
  clients,
  serviceTypes,
  onClose,
  onSaved,
}: {
  clients: any[];
  serviceTypes: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    projectNumber: "",
    clientId: "",
    serviceType: "",
    value: "",
    deliveryDate: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await api.post("/projects", form);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="مشروع جديد">
      {error && <div className="mb-3 rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="عنوان المشروع" required>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="رقم المشروع (اختياري)">
          <input
            className="input"
            placeholder="يُولّد تلقائياً"
            value={form.projectNumber}
            onChange={(e) => setForm({ ...form, projectNumber: e.target.value })}
          />
        </Field>
        <Field label="العميل" required>
          <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">اختر العميل</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="نوع الخدمة">
          <select
            className="input"
            value={form.serviceType}
            onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
          >
            <option value="">اختر النوع</option>
            {serviceTypes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="قيمة المشروع">
          <input
            type="number"
            className="input"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
        </Field>
        <Field label="موعد التسليم">
          <input
            type="date"
            className="input"
            value={form.deliveryDate}
            onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}
