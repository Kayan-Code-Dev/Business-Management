import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, StatCard, EmptyState, Modal, Field, Badge } from "../components/ui";
import { money, formatDate } from "../lib/format";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "payments", label: "سجل العمليات" },
  { key: "clientDues", label: "مستحقات العملاء" },
  { key: "specialistDues", label: "مستحقات المختصين" },
  { key: "expenses", label: "المصروفات" },
];

export default function Financial() {
  const { can } = useAuth();
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <PageHeader title="المالية" subtitle="الوضع المالي والمدفوعات والمستحقات" />
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto no-print">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "payments" && <Payments canDelete={can("financial", "delete")} />}
      {tab === "clientDues" && <Dues url="/financial/client-dues" entity="العميل" />}
      {tab === "specialistDues" && <Dues url="/financial/specialist-dues" entity="المختص" />}
      {tab === "expenses" && <Expenses canCreate={can("financial", "create")} canDelete={can("financial", "delete")} />}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get("/financial/overview").then((res) => setData(res.data));
  }, []);
  if (!data) return <Spinner />;
  const s = data.summary;
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard title="إجمالي قيمة المشاريع" value={money(s.totalValue)} icon="💼" tone="brand" />
        <StatCard title="المحصّل" value={money(s.totalClientPaid)} icon="💵" tone="green" />
        <StatCard title="غير المحصّل" value={money(s.totalUncollected)} icon="🧾" tone="red" />
        <StatCard title="مستحقات المختصين" value={money(s.totalSpecialistDue)} icon="👷" tone="amber" />
        <StatCard title="المصروفات" value={money(s.totalExpenses)} icon="💸" tone="amber" />
        <StatCard title="صافي الربح" value={money(s.totalNetProfit)} icon="📈" tone="green" />
        <StatCard title="مشاريع غير مسددة" value={s.unsettledCount} icon="⚠️" tone="red" />
      </div>
      <Card>
        <h3 className="font-bold text-slate-800 mb-3">الجدول المالي للمشاريع</h3>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>المشروع</th>
                <th>العميل</th>
                <th>القيمة</th>
                <th>مدفوع</th>
                <th>متبقي</th>
                <th>تكلفة المختصين</th>
                <th>مدفوع لهم</th>
                <th>الربح</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: any) => (
                <tr key={p.id}>
                  <td><Link className="text-brand-600 hover:underline" to={`/projects/${p.id}`}>{p.projectNumber}</Link></td>
                  <td>{p.client?.name}</td>
                  <td>{money(p.value)}</td>
                  <td className="text-green-600">{money(p.clientPaid)}</td>
                  <td className={p.clientRemaining > 0 ? "text-red-600" : ""}>{money(p.clientRemaining)}</td>
                  <td>{money(p.specialistCost)}</td>
                  <td className="text-amber-600">{money(p.specialistPaid)}</td>
                  <td className="text-brand-700 font-medium">{money(p.netProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Payments({ canDelete }: { canDelete: boolean }) {
  const [list, setList] = useState<any[]>([]);
  const [type, setType] = useState("all");
  const load = () => api.get("/financial/payments", { params: type !== "all" ? { type } : {} }).then((r) => setList(r.data));
  useEffect(() => { load(); }, [type]);
  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-slate-800">سجل العمليات المالية</h3>
        <select className="input max-w-[180px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">الكل</option>
          <option value="client_in">دفعات العملاء</option>
          <option value="specialist_out">دفعات المختصين</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>التاريخ</th><th>النوع</th><th>الطرف</th><th>المشروع</th><th>المبلغ</th><th>بواسطة</th>{canDelete && <th></th>}</tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{formatDate(p.date)}</td>
                <td>
                  <Badge color={p.type === "client_in" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                    {p.type === "client_in" ? "وارد (عميل)" : "صادر (مختص)"}
                  </Badge>
                </td>
                <td>{p.client?.name || p.specialist?.name || "—"}</td>
                <td>{p.project?.projectNumber || "—"}</td>
                <td className="font-medium">{money(p.amount)}</td>
                <td className="text-xs text-slate-500">{p.createdBy?.name || "—"}</td>
                {canDelete && (
                  <td>
                    <button className="text-red-500 text-xs hover:underline" onClick={async () => { if (confirm("حذف الدفعة؟")) { await api.delete(`/financial/payments/${p.id}`); load(); } }}>حذف</button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7}><EmptyState message="لا توجد عمليات" /></td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Dues({ url, entity }: { url: string; entity: string }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api.get(url).then((r) => setList(r.data)); }, [url]);
  return (
    <Card>
      <h3 className="font-bold text-slate-800 mb-3">مستحقات {entity === "العميل" ? "العملاء" : "المختصين"}</h3>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>{entity}</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{money(r.totalValue ?? r.totalCost)}</td>
                <td className="text-green-600">{money(r.totalPaid)}</td>
                <td className="text-red-600 font-medium">{money(r.remaining)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4}><EmptyState message="لا توجد مستحقات" /></td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Expenses({ canCreate, canDelete }: { canCreate: boolean; canDelete: boolean }) {
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const load = () => api.get("/financial/expenses").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-slate-800">المصروفات التشغيلية</h3>
        {canCreate && <button className="btn-secondary text-sm" onClick={() => setShow(true)}>+ مصروف</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>المشروع</th><th>ملاحظة</th>{canDelete && <th></th>}</tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.date)}</td>
                <td>{e.type || "—"}</td>
                <td className="font-medium">{money(e.amount)}</td>
                <td>{e.project?.projectNumber || "عام"}</td>
                <td>{e.note || "—"}</td>
                {canDelete && (
                  <td><button className="text-red-500 text-xs hover:underline" onClick={async () => { if (confirm("حذف المصروف؟")) { await api.delete(`/financial/expenses/${e.id}`); load(); } }}>حذف</button></td>
                )}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6}><EmptyState message="لا توجد مصروفات" /></td></tr>}
          </tbody>
        </table>
      </div>
      {show && <ExpenseModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </Card>
  );
}

function ExpenseModal({ onClose, onSaved }: any) {
  const [form, setForm] = useState({ type: "", amount: "", date: "", note: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      await api.post("/financial/expenses", form);
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="إضافة مصروف" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="النوع">
        <input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="المبلغ" required>
          <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="التاريخ">
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="ملاحظة">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
