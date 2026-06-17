import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, Spinner, StatusBadge, Progress, Modal, Field, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate, formatDateTime, PROJECT_STATUS_FLOW, statusLabel, STATUS_META } from "../lib/format";
import { useToast } from "../lib/toast";

export default function ProjectDetail() {
  const { id } = useParams();
  const { can, flag } = useAuth();
  const { notify } = useToast();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [tab, setTab] = useState("specialists");

  const load = () => api.get(`/projects/${id}`).then((res) => setP(res.data)).finally(() => setLoading(false));

  useEffect(() => {
    load();
    if (can("specialists", "view")) api.get("/specialists").then((res) => setSpecialists(res.data));
  }, [id]);

  if (loading) return <Spinner />;
  if (!p) return <div className="text-center py-16 text-ink-400">المشروع غير موجود</div>;

  const canEdit = can("projects", "edit");
  const canFinance = can("financial", "create");
  const currentIdx = PROJECT_STATUS_FLOW.indexOf(p.status);

  const tabs = [
    { key: "specialists", label: "المختصون", icon: "specialists", count: p.specialists.length },
    { key: "files", label: "الملفات", icon: "file", count: p.files.length },
    ...(flag("viewProfits") || can("financial", "view") ? [{ key: "payments", label: "الدفعات", icon: "money", count: p.payments?.length || 0 }] : []),
    { key: "notes", label: "الملاحظات", icon: "note", count: p.notes_list.length },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-sm no-print">
        <Link to="/projects" className="text-ink-500 hover:text-brand-600 flex items-center gap-1">
          <Icon name="chevronRight" size={16} /> المشاريع
        </Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-700 font-medium">{p.projectNumber}</span>
      </div>

      <Card className="mb-5 !p-6 relative overflow-hidden">
        <div className={`absolute top-0 right-0 h-1.5 w-full ${STATUS_META[p.status]?.dot || "bg-ink-300"}`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">{p.projectNumber}</span>
              <StatusBadge status={p.status} isLate={p.isLate} />
              {p.serviceType && <Badge color="bg-ink-100 text-ink-600">{p.serviceType}</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold text-ink-900">{p.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-ink-500">
              <Link to={`/clients/${p.client?.id}`} className="flex items-center gap-1.5 hover:text-brand-600">
                <Icon name="user" size={15} /> {p.client?.name}
              </Link>
              <span className="flex items-center gap-1.5"><Icon name="calendar" size={15} /> التسليم: {formatDate(p.deliveryDate)}</span>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2 no-print">
              <button className="btn-secondary" onClick={() => setModal("share")}>
                <Icon name="user" size={16} /> رابط العميل
              </button>
              <button className="btn-secondary" onClick={() => setModal("status")}>
                <Icon name="activity" size={16} /> تغيير الحالة
              </button>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="mt-6 flex items-center gap-0 overflow-x-auto pb-2">
          {PROJECT_STATUS_FLOW.map((s, i) => {
            const done = currentIdx >= i && p.status !== "cancelled";
            const active = currentIdx === i;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className="flex flex-col items-center">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition ${active ? "bg-brand-gradient text-white shadow-glow ring-4 ring-brand-100" : done ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"}`}>
                    {done && !active ? <Icon name="check" size={15} /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1.5 whitespace-nowrap ${done ? "text-ink-700 font-medium" : "text-ink-400"}`}>{statusLabel(s)}</span>
                </div>
                {i < PROJECT_STATUS_FLOW.length - 1 && <div className={`h-0.5 w-10 lg:w-14 mb-5 ${currentIdx > i ? "bg-brand-500" : "bg-ink-200"}`} />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 max-w-md">
          <div className="flex justify-between text-xs text-ink-500 mb-1">
            <span>نسبة الإنجاز</span>
            <span className="font-bold text-ink-700">{p.progress}%</span>
          </div>
          <Progress value={p.progress} />
        </div>
      </Card>

      {/* Finance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <FinCard label="قيمة المشروع" value={money(p.finance.value)} icon="briefcase" tone="brand" />
        <FinCard label="مدفوع من العميل" value={money(p.finance.clientPaid)} icon="money" tone="green" />
        <FinCard label="متبقي على العميل" value={money(p.finance.clientRemaining)} icon="alert" tone="red" />
        {flag("viewProfits") && <FinCard label="صافي الربح" value={money(p.finance.netProfit)} icon="trendUp" tone="violet" />}
        {flag("viewSpecialistCosts") && (
          <>
            <FinCard label="تكلفة المختصين" value={money(p.finance.specialistCost)} icon="specialists" tone="slate" />
            <FinCard label="مدفوع للمختصين" value={money(p.finance.specialistPaid)} icon="wallet" tone="amber" />
            <FinCard label="مستحق للمختصين" value={money(p.finance.specialistRemaining)} icon="clock" tone="red" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex border-b border-ink-100 overflow-x-auto no-print">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${tab === t.key ? "border-brand-600 text-brand-700 bg-brand-50/40" : "border-transparent text-ink-500 hover:text-ink-700"}`}
            >
              <Icon name={t.icon as any} size={16} /> {t.label}
              <span className={`badge ${tab === t.key ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "specialists" && (
            <Section
              title="المختصون المرتبطون"
              action={canEdit && can("specialists", "view") && <AddBtn label="تعيين مختص" onClick={() => setModal("specialist")} />}
            >
              {p.specialists.map((s: any) => (
                <Row key={s.id}>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">{s.name?.charAt(0)}</div>
                    <div>
                      <div className="font-semibold text-ink-800">{s.name}</div>
                      <div className="text-xs text-ink-500">
                        {s.role || "—"} {flag("viewSpecialistCosts") && `· التكلفة ${money(s.cost)}`}
                        {s.internalDeliveryDate && ` · تسليم داخلي ${formatDate(s.internalDeliveryDate)}`}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <button className="text-red-400 hover:text-red-600 h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center" onClick={async () => { if (confirm("إزالة المختص؟")) { await api.delete(`/projects/${id}/specialists/${s.id}`); notify("تمت الإزالة"); load(); } }}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </Row>
              ))}
              {p.specialists.length === 0 && <Empty text="لا يوجد مختصون مرتبطون" />}
            </Section>
          )}

          {tab === "files" && (
            <Section title="ملفات المشروع" action={canEdit && <AddBtn label="رفع ملف" icon="upload" onClick={() => setModal("file")} />}>
              {p.files.map((f: any) => (
                <Row key={f.id}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon name="file" size={18} /></div>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-800 truncate">{f.name}</div>
                      <div className="text-xs text-ink-500 flex items-center gap-1.5">
                        <Badge color={f.category === "client" ? "bg-blue-50 text-blue-700" : f.category === "specialist" ? "bg-violet-50 text-violet-700" : "bg-ink-100 text-ink-600"}>
                          {f.category === "client" ? "عميل" : f.category === "specialist" ? "مختص" : "عام"}
                        </Badge>
                        {f.uploadedBy} · {formatDate(f.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-brand-50 hover:text-brand-600" onClick={() => downloadFile(f.id, f.name)} title="تنزيل"><Icon name="download" size={16} /></button>
                    {canEdit && <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={async () => { if (confirm("حذف الملف؟")) { await api.delete(`/files/${f.id}`); notify("تم الحذف"); load(); } }} title="حذف"><Icon name="trash" size={16} /></button>}
                  </div>
                </Row>
              ))}
              {p.files.length === 0 && <Empty text="لا توجد ملفات" />}
            </Section>
          )}

          {tab === "payments" && (
            <Section
              title="الدفعات"
              action={canFinance && (
                <div className="flex gap-2">
                  <AddBtn label="دفعة عميل" icon="money" onClick={() => setModal("clientPay")} />
                  <AddBtn label="دفعة مختص" icon="wallet" onClick={() => setModal("specPay")} />
                </div>
              )}
            >
              {p.payments?.map((pay: any) => (
                <Row key={pay.id}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${pay.type === "client_in" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      <Icon name={pay.type === "client_in" ? "arrowDown" : "arrowUp"} size={18} />
                    </div>
                    <div>
                      <div className="font-semibold text-ink-800">{pay.type === "client_in" ? "دفعة من العميل" : `دفعة للمختص ${pay.specialist?.name || ""}`}</div>
                      <div className="text-xs text-ink-500">{formatDate(pay.date)} · {pay.method || "—"} · بواسطة {pay.createdBy || "—"}</div>
                    </div>
                  </div>
                  <div className={`font-extrabold ${pay.type === "client_in" ? "text-emerald-600" : "text-amber-600"}`}>{money(pay.amount)}</div>
                </Row>
              ))}
              {(!p.payments || p.payments.length === 0) && <Empty text="لا توجد دفعات" />}
            </Section>
          )}

          {tab === "notes" && (
            <Section title="ملاحظات المشروع" action={canEdit && <AddBtn label="ملاحظة" icon="note" onClick={() => setModal("note")} />}>
              {p.notes_list.map((n: any) => (
                <div key={n.id} className="border border-ink-100 rounded-xl p-4 bg-ink-50/40">
                  <div className="text-sm text-ink-700">{n.text}</div>
                  <div className="text-xs text-ink-400 mt-2 flex items-center gap-1.5"><Icon name="user" size={12} /> {n.author} · {formatDateTime(n.createdAt)}</div>
                </div>
              ))}
              {p.notes_list.length === 0 && <Empty text="لا توجد ملاحظات" />}
            </Section>
          )}
        </div>
      </Card>

      {modal === "share" && <ShareModal project={p} onClose={() => setModal(null)} onChanged={load} notify={notify} canEdit={canEdit} />}
      {modal === "status" && <StatusModal project={p} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تم تحديث الحالة"); load(); }} />}
      {modal === "specialist" && <AssignSpecialistModal projectId={id!} specialists={specialists} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تم التعيين"); load(); }} />}
      {modal === "file" && <UploadFileModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تم الرفع"); load(); }} />}
      {modal === "note" && <NoteModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تمت الإضافة"); load(); }} />}
      {modal === "clientPay" && <ClientPayModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تم تسجيل الدفعة"); load(); }} />}
      {modal === "specPay" && <SpecialistPayModal projectId={id!} specialists={p.specialists} onClose={() => setModal(null)} onSaved={() => { setModal(null); notify("تم تسجيل الدفعة"); load(); }} />}
    </div>
  );
}

function FinCard({ label, value, icon, tone }: any) {
  const tones: any = {
    brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600", amber: "bg-amber-50 text-amber-600", slate: "bg-ink-100 text-ink-600",
  };
  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-500">{label}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon name={icon} size={16} /></div>
      </div>
      <div className="text-xl font-extrabold text-ink-900 mt-1">{value}</div>
    </div>
  );
}

const Section = ({ title, action, children }: any) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-ink-800">{title}</h3>
      <div className="no-print">{action}</div>
    </div>
    <div className="space-y-2.5">{children}</div>
  </div>
);
const Row = ({ children }: any) => <div className="flex items-center justify-between border border-ink-100 rounded-xl p-3 hover:border-ink-200 transition">{children}</div>;
const Empty = ({ text }: any) => <div className="text-center text-sm text-ink-400 py-8">{text}</div>;
const AddBtn = ({ label, icon = "plus", onClick }: any) => (
  <button className="btn-secondary btn-sm" onClick={onClick}><Icon name={icon} size={15} /> {label}</button>
);

async function downloadFile(fileId: number, name: string) {
  const res = await api.get(`/files/${fileId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ShareModal({ project, onClose, onChanged, notify, canEdit }: any) {
  const [token, setToken] = useState<string | null>(project.publicToken || null);
  const [busy, setBusy] = useState(false);
  const url = token ? `${window.location.origin}/p/${token}` : "";

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/projects/${project.id}/share`);
      setToken(res.data.token);
      onChanged();
      notify("تم إنشاء الرابط");
    } catch (e) {
      notify(apiError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!confirm("إلغاء الرابط؟ لن يتمكن العميل من الوصول بعدها.")) return;
    setBusy(true);
    try {
      await api.delete(`/projects/${project.id}/share`);
      setToken(null);
      onChanged();
      notify("تم إلغاء الرابط");
    } catch (e) {
      notify(apiError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify("تم نسخ الرابط");
    } catch {
      notify("انسخ الرابط يدوياً", "info");
    }
  };

  return (
    <Modal open onClose={onClose} title="رابط متابعة العميل" subtitle="شارك هذا الرابط مع العميل لمتابعة مشروعه" size="md">
      <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 mb-4 text-sm text-brand-800 flex gap-2">
        <Icon name="eye" size={18} className="shrink-0 mt-0.5" />
        <span>الرابط يعرض للعميل: حالة المشروع والتقدّم والمواعيد والملخص المالي ودفعاته والملاحظات والملفات الخاصة به فقط — بدون أي بيانات داخلية (تكاليف المختصين أو الأرباح).</span>
      </div>

      {token ? (
        <>
          <Field label="الرابط العام">
            <div className="flex gap-2">
              <input className="input text-left ltr" dir="ltr" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="btn-primary shrink-0" onClick={copy}><Icon name="file" size={16} /> نسخ</button>
            </div>
          </Field>
          <div className="flex justify-between gap-2 mt-6">
            <a href={url} target="_blank" rel="noreferrer" className="btn-secondary"><Icon name="eye" size={16} /> معاينة</a>
            {canEdit && <button className="btn-ghost text-red-500" onClick={revoke} disabled={busy}><Icon name="trash" size={16} /> إلغاء الرابط</button>}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <p className="text-ink-500 text-sm mb-4">لا يوجد رابط بعد. أنشئ رابطاً آمناً لمشاركته مع العميل.</p>
          <button className="btn-primary" onClick={generate} disabled={busy}>{busy ? "..." : "إنشاء رابط المتابعة"}</button>
        </div>
      )}
    </Modal>
  );
}

function StatusModal({ project, onClose, onSaved }: any) {
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(project.progress);
  const [err, setErr] = useState("");
  const all = [...PROJECT_STATUS_FLOW, "cancelled"];
  const save = async () => {
    try { await api.patch(`/projects/${project.id}/status`, { status, progress }); onSaved(); }
    catch (e) { setErr(apiError(e)); }
  };
  return (
    <Modal open onClose={onClose} title="تغيير حالة المشروع" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="الحالة">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {all.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </Field>
      <div className="mt-4">
        <Field label={`نسبة الإنجاز: ${progress}%`}>
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-brand-600" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function AssignSpecialistModal({ projectId, specialists, onClose, onSaved }: any) {
  const [form, setForm] = useState({ specialistId: "", role: "", cost: "", internalDeliveryDate: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    try { await api.post(`/projects/${projectId}/specialists`, form); onSaved(); }
    catch (e) { setErr(apiError(e)); }
  };
  return (
    <Modal open onClose={onClose} title="تعيين مختص">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="المختص" required>
          <select className="input" value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value })}>
            <option value="">اختر</option>
            {specialists.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="الدور"><input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
        <Field label="التكلفة المتفق عليها"><input type="number" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
        <Field label="موعد التسليم الداخلي"><input type="date" className="input" value={form.internalDeliveryDate} onChange={(e) => setForm({ ...form, internalDeliveryDate: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function UploadFileModal({ projectId, onClose, onSaved }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("client");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!file) return setErr("اختر ملفاً");
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.append("file", file); fd.append("category", category); if (name) fd.append("name", name);
    try { await api.post(`/projects/${projectId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } }); onSaved(); }
    catch (e) { setErr(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="رفع ملف" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="التصنيف">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="client">ملف عميل</option>
          <option value="specialist">ملف مختص</option>
          <option value="general">عام</option>
        </select>
      </Field>
      <div className="mt-3"><Field label="اسم وصفي (اختياري)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
      <div className="mt-3"><Field label="الملف" required><input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field></div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "جارٍ الرفع..." : "رفع"}</button>
      </div>
    </Modal>
  );
}

function NoteModal({ projectId, onClose, onSaved }: any) {
  const [text, setText] = useState("");
  const [type, setType] = useState("general");
  const save = async () => { if (!text) return; await api.post(`/projects/${projectId}/notes`, { text, type }); onSaved(); };
  return (
    <Modal open onClose={onClose} title="إضافة ملاحظة" size="sm">
      <Field label="النوع">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="general">عامة</option><option value="edit">تعديل</option><option value="internal">داخلية</option>
        </select>
      </Field>
      <div className="mt-3"><Field label="النص" required><textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></Field></div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function ClientPayModal({ projectId, onClose, onSaved }: any) {
  const [form, setForm] = useState({ amount: "", date: "", method: "", note: "" });
  const [err, setErr] = useState("");
  const save = async () => { try { await api.post(`/financial/payments/client`, { ...form, projectId }); onSaved(); } catch (e) { setErr(apiError(e)); } };
  return (
    <Modal open onClose={onClose} title="دفعة من العميل" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="المبلغ" required><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="التاريخ"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="طريقة الدفع"><input className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function SpecialistPayModal({ projectId, specialists, onClose, onSaved }: any) {
  const [form, setForm] = useState({ specialistId: "", amount: "", date: "", method: "", note: "" });
  const [err, setErr] = useState("");
  const save = async () => { try { await api.post(`/financial/payments/specialist`, { ...form, projectId }); onSaved(); } catch (e) { setErr(apiError(e)); } };
  return (
    <Modal open onClose={onClose} title="دفعة لمختص" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="المختص" required>
        <select className="input" value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value })}>
          <option value="">اختر</option>
          {specialists.map((s: any) => <option key={s.specialistId} value={s.specialistId}>{s.name}</option>)}
        </select>
      </Field>
      <div className="mt-3"><Field label="المبلغ" required><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field></div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="التاريخ"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="طريقة الدفع"><input className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
