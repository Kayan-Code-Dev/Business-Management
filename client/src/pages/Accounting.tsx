import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, StatCard, EmptyState, Modal, Field, Badge, TableSkeleton } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate } from "../lib/format";
import { useToast } from "../lib/toast";

const TABS = [
  { key: "treasuries", label: "الخزائن", icon: "wallet" },
  { key: "ledger", label: "كشف المعاملات", icon: "list" },
  { key: "payments", label: "المدفوعات", icon: "money" },
  { key: "expenses", label: "المصروفات", icon: "trendUp" },
  { key: "journal", label: "القيود", icon: "file" },
];

const CAT_COLORS: Record<string, string> = {
  client_payment: "bg-emerald-50 text-emerald-700",
  specialist_payment: "bg-amber-50 text-amber-700",
  expense: "bg-red-50 text-red-700",
  deposit: "bg-brand-50 text-brand-700",
  withdrawal: "bg-orange-50 text-orange-700",
  transfer: "bg-violet-50 text-violet-700",
  other: "bg-ink-100 text-ink-600",
};

export default function Accounting() {
  const { can } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState("treasuries");
  const [summary, setSummary] = useState<any>(null);
  const [treasuries, setTreasuries] = useState<any[]>([]);

  const loadHead = () => {
    api.get("/accounting/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/accounting/treasuries").then((r) => setTreasuries(r.data)).catch(() => {});
  };
  useEffect(() => { loadHead(); }, []);

  return (
    <div>
      <PageHeader title="المحاسبة" subtitle="الخزائن والحركات المالية والقيود" icon="financial" />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard title="إجمالي رصيد الخزائن" value={money(summary.totalBalance)} icon="wallet" tone="brand" />
          <StatCard title="إجمالي الوارد" value={money(summary.totalIn)} icon="arrowDown" tone="green" />
          <StatCard title="إجمالي الصادر" value={money(summary.totalOut)} icon="arrowUp" tone="red" />
          <StatCard title="صافي هذا الشهر" value={money(summary.monthIn - summary.monthOut)} icon="trendUp" tone="violet" />
        </div>
      )}

      <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto no-print">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700"}`}>
            <Icon name={t.icon as any} size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "treasuries" && <TreasuriesTab treasuries={treasuries} reload={loadHead} can={can} notify={notify} />}
      {tab === "ledger" && <LedgerTab treasuries={treasuries} can={can} notify={notify} />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "expenses" && <ExpensesTab treasuries={treasuries} can={can} notify={notify} reload={loadHead} />}
      {tab === "journal" && <JournalTab />}
    </div>
  );
}

/* ---------- Treasuries ---------- */
function TreasuriesTab({ treasuries, reload, can, notify }: any) {
  const [modal, setModal] = useState<any>(null);
  const canCreate = can("accounting", "create");
  const total = treasuries.reduce((s: number, t: any) => s + t.balance, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm text-ink-500">إجمالي السيولة: <span className="font-extrabold text-ink-900 text-lg">{money(total)}</span></div>
        {canCreate && (
          <div className="flex flex-wrap gap-2 no-print">
            <button className="btn-secondary btn-sm" onClick={() => setModal({ type: "deposit" })}><Icon name="arrowDown" size={15} /> إيداع</button>
            <button className="btn-secondary btn-sm" onClick={() => setModal({ type: "withdrawal" })}><Icon name="arrowUp" size={15} /> سحب</button>
            <button className="btn-secondary btn-sm" onClick={() => setModal({ type: "transfer" })}><Icon name="activity" size={15} /> تحويل</button>
            <button className="btn-primary btn-sm" onClick={() => setModal({ type: "treasury" })}><Icon name="plus" size={15} /> خزنة</button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {treasuries.map((t: any) => (
          <div key={t.id} className="card card-hover p-5 relative overflow-hidden">
            <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-brand-50" />
            <div className="relative flex items-start justify-between">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${t.type === "bank" ? "bg-violet-50 text-violet-600" : "bg-emerald-50 text-emerald-600"}`}>
                <Icon name={t.type === "bank" ? "building" : "wallet"} size={24} />
              </div>
              <div className="flex items-center gap-1">
                {t.isDefault && <Badge color="bg-brand-50 text-brand-700">افتراضية</Badge>}
                {can("accounting", "edit") && <button className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100" onClick={() => setModal({ type: "treasury", treasury: t })}><Icon name="edit" size={14} /></button>}
              </div>
            </div>
            <div className="relative mt-3">
              <div className="text-sm text-ink-500">{t.name}</div>
              <div className="text-2xl font-extrabold text-ink-900 mt-1">{money(t.balance)}</div>
              <div className="text-xs text-ink-400 mt-1">{t.type === "bank" ? "حساب بنكي" : "نقدي"} {t.openingBalance ? `· رصيد افتتاحي ${money(t.openingBalance)}` : ""}</div>
            </div>
          </div>
        ))}
        {treasuries.length === 0 && <div className="col-span-full"><EmptyState message="لا توجد خزائن" icon="wallet" /></div>}
      </div>

      {modal?.type === "treasury" && <TreasuryModal treasury={modal.treasury} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); notify("تم الحفظ"); }} />}
      {["deposit", "withdrawal", "transfer"].includes(modal?.type) && <OperationModal type={modal.type} treasuries={treasuries} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); notify("تمت العملية"); }} />}
    </div>
  );
}

function TreasuryModal({ treasury, onClose, onSaved }: any) {
  const [form, setForm] = useState({ name: treasury?.name || "", type: treasury?.type || "cash", openingBalance: treasury?.openingBalance ?? 0, isDefault: treasury?.isDefault || false, notes: treasury?.notes || "" });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      if (treasury) await api.put(`/accounting/treasuries/${treasury.id}`, form);
      else await api.post("/accounting/treasuries", form);
      onSaved();
    } catch (e) { setErr(apiError(e)); }
  };
  return (
    <Modal open onClose={onClose} title={treasury ? "تعديل خزنة" : "خزنة جديدة"} size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="الاسم" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="النوع"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="cash">نقدي</option><option value="bank">بنكي</option></select></Field>
        <Field label="الرصيد الافتتاحي"><input type="number" className="input" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4" /> خزنة افتراضية</label>
      <div className="flex justify-end gap-2 mt-5"><button className="btn-secondary" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></div>
    </Modal>
  );
}

function OperationModal({ type, treasuries, onClose, onSaved }: any) {
  const def = treasuries.find((t: any) => t.isDefault) || treasuries[0];
  const [form, setForm] = useState<any>({ treasuryId: def?.id || "", toTreasuryId: "", amount: "", date: "", description: "" });
  const [err, setErr] = useState("");
  const titles: any = { deposit: "إيداع نقدي", withdrawal: "سحب نقدي", transfer: "تحويل بين الخزائن" };
  const save = async () => {
    try { await api.post("/accounting/operations", { type, ...form }); onSaved(); }
    catch (e) { setErr(apiError(e)); }
  };
  return (
    <Modal open onClose={onClose} title={titles[type]} size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label={type === "transfer" ? "من خزنة" : "الخزنة"} required>
        <select className="input" value={form.treasuryId} onChange={(e) => setForm({ ...form, treasuryId: e.target.value })}>
          {treasuries.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({money(t.balance)})</option>)}
        </select>
      </Field>
      {type === "transfer" && (
        <div className="mt-3"><Field label="إلى خزنة" required>
          <select className="input" value={form.toTreasuryId} onChange={(e) => setForm({ ...form, toTreasuryId: e.target.value })}>
            <option value="">اختر</option>
            {treasuries.filter((t: any) => String(t.id) !== String(form.treasuryId)).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field></div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="المبلغ" required><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      </div>
      <div className="mt-3"><Field label="الوصف"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
      <div className="flex justify-end gap-2 mt-5"><button className="btn-secondary" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>تنفيذ</button></div>
    </Modal>
  );
}

/* ---------- Ledger ---------- */
function LedgerTab({ treasuries, can, notify }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ treasuryId: "all", direction: "all", category: "all", search: "" });
  const load = () => {
    setLoading(true);
    const p: any = {};
    Object.entries(f).forEach(([k, v]) => { if (v && v !== "all") p[k] = v; });
    api.get("/accounting/transactions", { params: p }).then((r) => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [f.treasuryId, f.direction, f.category]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 flex flex-wrap gap-2 border-b border-ink-100">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"><Icon name="search" size={16} /></span>
          <input className="input pr-9" placeholder="بحث في الوصف" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <select className="input !w-auto" value={f.treasuryId} onChange={(e) => setF({ ...f, treasuryId: e.target.value })}><option value="all">كل الخزائن</option>{treasuries.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="input !w-auto" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="all">الكل</option><option value="in">وارد</option><option value="out">صادر</option></select>
        <select className="input !w-auto" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="all">كل الأنواع</option><option value="client_payment">دفعة عميل</option><option value="specialist_payment">دفعة مختص</option><option value="expense">مصروف</option><option value="deposit">إيداع</option><option value="withdrawal">سحب</option><option value="transfer">تحويل</option>
        </select>
      </div>
      {loading ? <div className="p-5"><TableSkeleton rows={6} cols={5} /></div> : list.length === 0 ? <EmptyState message="لا توجد حركات" icon="list" /> : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>الخزنة</th><th>وارد</th><th>صادر</th><th>بواسطة</th>{can("accounting", "delete") && <th></th>}</tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap text-sm">{formatDate(t.date)}</td>
                  <td><Badge color={CAT_COLORS[t.category]}>{t.categoryLabel}</Badge></td>
                  <td className="max-w-[260px] truncate">{t.description}</td>
                  <td className="text-sm">{t.treasury}</td>
                  <td className="text-emerald-600 font-semibold">{t.direction === "in" ? money(t.amount) : "—"}</td>
                  <td className="text-red-600 font-semibold">{t.direction === "out" ? money(t.amount) : "—"}</td>
                  <td className="text-xs text-ink-500">{t.createdBy || "—"}</td>
                  {can("accounting", "delete") && (
                    <td>
                      {["deposit", "withdrawal", "transfer", "other"].includes(t.category) && (
                        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={async () => { if (confirm("حذف الحركة؟")) { try { await api.delete(`/accounting/transactions/${t.id}`); notify("تم الحذف"); load(); } catch (e) { notify(apiError(e), "error"); } } }}><Icon name="trash" size={15} /></button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Payments ---------- */
function PaymentsTab() {
  const [list, setList] = useState<any[]>([]);
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.get("/financial/payments", { params: type !== "all" ? { type } : {} }).then((r) => setList(r.data)).finally(() => setLoading(false)); }, [type]);
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 border-b border-ink-100 flex justify-between items-center">
        <h3 className="font-bold text-ink-800">سجل المدفوعات</h3>
        <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="all">الكل</option><option value="client_in">من العملاء</option><option value="specialist_out">للمختصين</option></select>
      </div>
      {loading ? <div className="p-5"><TableSkeleton rows={5} cols={5} /></div> : list.length === 0 ? <EmptyState message="لا توجد مدفوعات" icon="money" /> : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الطرف</th><th>المشروع</th><th>المبلغ</th><th>الطريقة</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="text-sm">{formatDate(p.date)}</td>
                  <td><Badge color={p.type === "client_in" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>{p.type === "client_in" ? "وارد" : "صادر"}</Badge></td>
                  <td>{p.client?.name || p.specialist?.name || "—"}</td>
                  <td className="text-sm">{p.project?.projectNumber || "—"}</td>
                  <td className="font-bold">{money(p.amount)}</td>
                  <td className="text-sm">{p.method || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Expenses ---------- */
function ExpensesTab({ treasuries, can, notify, reload }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const load = () => { setLoading(true); api.get("/financial/expenses").then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 border-b border-ink-100 flex justify-between items-center">
        <h3 className="font-bold text-ink-800">المصروفات التشغيلية</h3>
        {can("financial", "create") && <button className="btn-primary btn-sm" onClick={() => setShow(true)}><Icon name="plus" size={15} /> مصروف</button>}
      </div>
      {loading ? <div className="p-5"><TableSkeleton rows={5} cols={4} /></div> : list.length === 0 ? <EmptyState message="لا توجد مصروفات" icon="trendUp" /> : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>المشروع</th><th>ملاحظة</th>{can("financial", "delete") && <th></th>}</tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="text-sm">{formatDate(e.date)}</td>
                  <td>{e.type || "—"}</td>
                  <td className="font-bold text-red-600">{money(e.amount)}</td>
                  <td className="text-sm">{e.project?.projectNumber || "عام"}</td>
                  <td className="text-sm">{e.note || "—"}</td>
                  {can("financial", "delete") && <td><button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={async () => { if (confirm("حذف؟")) { await api.delete(`/financial/expenses/${e.id}`); notify("تم الحذف"); load(); reload(); } }}><Icon name="trash" size={15} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && <ExpenseModal treasuries={treasuries} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); reload(); notify("تمت الإضافة"); }} />}
    </Card>
  );
}

function ExpenseModal({ treasuries, onClose, onSaved }: any) {
  const def = treasuries.find((t: any) => t.isDefault) || treasuries[0];
  const [form, setForm] = useState<any>({ type: "", amount: "", date: "", note: "", treasuryId: def?.id || "" });
  const [err, setErr] = useState("");
  const save = async () => { try { await api.post("/financial/expenses", form); onSaved(); } catch (e) { setErr(apiError(e)); } };
  return (
    <Modal open onClose={onClose} title="إضافة مصروف" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="النوع"><input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="المبلغ" required><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      </div>
      <div className="mt-3"><Field label="الخزنة (يُخصم منها)"><select className="input" value={form.treasuryId} onChange={(e) => setForm({ ...form, treasuryId: e.target.value })}>{treasuries.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field></div>
      <div className="mt-3"><Field label="ملاحظة"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field></div>
      <div className="flex justify-end gap-2 mt-5"><button className="btn-secondary" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></div>
    </Modal>
  );
}

/* ---------- Journal ---------- */
function JournalTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/accounting/journal").then((r) => setList(r.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <Card><TableSkeleton rows={6} cols={3} /></Card>;
  if (list.length === 0) return <Card><EmptyState message="لا توجد قيود" icon="file" /></Card>;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
          <tbody>
            {list.map((e) => e.lines.map((l: any, i: number) => (
              <tr key={`${e.id}-${i}`} className={i === e.lines.length - 1 ? "border-b-2 border-ink-200" : ""}>
                <td className="text-xs text-brand-600 font-semibold">{i === 0 ? e.reference : ""}</td>
                <td className="text-sm">{i === 0 ? formatDate(e.date) : ""}</td>
                <td className="text-sm max-w-[220px] truncate">{i === 0 ? e.description : ""}</td>
                <td className={l.debit ? "font-medium" : "pr-8 text-ink-600"}>{l.account}</td>
                <td className="text-emerald-700 font-semibold">{l.debit ? money(l.debit) : ""}</td>
                <td className="text-red-700 font-semibold">{l.credit ? money(l.credit) : ""}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
