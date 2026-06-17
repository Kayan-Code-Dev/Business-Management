import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatusBadge, Progress, Modal, Field, Badge } from "../components/ui";
import { money, formatDate, formatDateTime, PROJECT_STATUS_FLOW, statusLabel } from "../lib/format";

export default function ProjectDetail() {
  const { id } = useParams();
  const { can, flag } = useAuth();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);

  const load = () => {
    api
      .get(`/projects/${id}`)
      .then((res) => setP(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (can("specialists", "view")) api.get("/specialists").then((res) => setSpecialists(res.data));
  }, [id]);

  if (loading) return <Spinner />;
  if (!p) return <div className="text-center py-12 text-slate-400">المشروع غير موجود</div>;

  const canEdit = can("projects", "edit");
  const canFinance = can("financial", "create");

  return (
    <div>
      <PageHeader
        title={`${p.projectNumber} · ${p.title}`}
        subtitle={`العميل: ${p.client?.name}`}
        actions={
          <>
            <Link to="/projects" className="btn-secondary">
              رجوع
            </Link>
            {canEdit && (
              <button className="btn-secondary" onClick={() => setModal("status")}>
                تغيير الحالة
              </button>
            )}
          </>
        }
      />

      {/* Status timeline */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} isLate={p.isLate} />
            {p.serviceType && <Badge>{p.serviceType}</Badge>}
          </div>
          <div className="text-sm text-slate-500">موعد التسليم: {formatDate(p.deliveryDate)}</div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {PROJECT_STATUS_FLOW.map((s, i) => {
            const currentIdx = PROJECT_STATUS_FLOW.indexOf(p.status);
            const done = currentIdx >= i && p.status !== "cancelled";
            return (
              <div key={s} className="flex items-center shrink-0">
                <div
                  className={`flex flex-col items-center ${done ? "text-brand-600" : "text-slate-300"}`}
                >
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-[10px] mt-1 whitespace-nowrap">{statusLabel(s)}</span>
                </div>
                {i < PROJECT_STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 w-8 ${done ? "bg-brand-400" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>نسبة الإنجاز</span>
            <span>{p.progress}%</span>
          </div>
          <Progress value={p.progress} />
        </div>
      </Card>

      {/* Financial summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="!p-4">
          <div className="text-sm text-slate-500">قيمة المشروع</div>
          <div className="text-xl font-bold text-slate-800">{money(p.finance.value)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">مدفوع من العميل</div>
          <div className="text-xl font-bold text-green-600">{money(p.finance.clientPaid)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">متبقي على العميل</div>
          <div className="text-xl font-bold text-red-600">{money(p.finance.clientRemaining)}</div>
        </Card>
        {flag("viewProfits") && (
          <Card className="!p-4">
            <div className="text-sm text-slate-500">صافي الربح</div>
            <div className="text-xl font-bold text-brand-700">{money(p.finance.netProfit)}</div>
          </Card>
        )}
        {flag("viewSpecialistCosts") && (
          <>
            <Card className="!p-4">
              <div className="text-sm text-slate-500">تكلفة المختصين</div>
              <div className="text-xl font-bold text-slate-800">{money(p.finance.specialistCost)}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-sm text-slate-500">مدفوع للمختصين</div>
              <div className="text-xl font-bold text-amber-600">{money(p.finance.specialistPaid)}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-sm text-slate-500">مستحق للمختصين</div>
              <div className="text-xl font-bold text-red-600">{money(p.finance.specialistRemaining)}</div>
            </Card>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Specialists */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">المختصون</h3>
            {canEdit && can("specialists", "view") && (
              <button className="btn-secondary text-xs" onClick={() => setModal("specialist")}>
                + تعيين مختص
              </button>
            )}
          </div>
          <div className="space-y-2">
            {p.specialists.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div>
                  <div className="font-medium text-slate-700">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {s.role || "—"} {flag("viewSpecialistCosts") && `· التكلفة ${money(s.cost)}`}
                    {s.internalDeliveryDate && ` · تسليم داخلي ${formatDate(s.internalDeliveryDate)}`}
                  </div>
                </div>
                {canEdit && (
                  <button
                    className="text-red-500 text-xs hover:underline"
                    onClick={async () => {
                      if (confirm("إزالة المختص من المشروع؟")) {
                        await api.delete(`/projects/${id}/specialists/${s.id}`);
                        load();
                      }
                    }}
                  >
                    إزالة
                  </button>
                )}
              </div>
            ))}
            {p.specialists.length === 0 && <div className="text-sm text-slate-400">لا يوجد مختصون</div>}
          </div>
        </Card>

        {/* Files */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">الملفات</h3>
            {canEdit && (
              <button className="btn-secondary text-xs" onClick={() => setModal("file")}>
                + رفع ملف
              </button>
            )}
          </div>
          <div className="space-y-2">
            {p.files.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-700 truncate">{f.name}</div>
                  <div className="text-xs text-slate-500">
                    <Badge color={f.category === "client" ? "bg-blue-100 text-blue-700" : f.category === "specialist" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}>
                      {f.category === "client" ? "عميل" : f.category === "specialist" ? "مختص" : "عام"}
                    </Badge>{" "}
                    {f.uploadedBy} · {formatDate(f.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-brand-600 text-xs hover:underline" onClick={() => downloadFile(f.id, f.name)}>
                    تنزيل
                  </button>
                  {canEdit && (
                    <button
                      className="text-red-500 text-xs hover:underline"
                      onClick={async () => {
                        if (confirm("حذف الملف؟")) {
                          await api.delete(`/files/${f.id}`);
                          load();
                        }
                      }}
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
            {p.files.length === 0 && <div className="text-sm text-slate-400">لا توجد ملفات</div>}
          </div>
        </Card>

        {/* Payments */}
        {(flag("viewProfits") || can("financial", "view")) && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">الدفعات</h3>
              {canFinance && (
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs" onClick={() => setModal("clientPay")}>
                    + دفعة عميل
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setModal("specPay")}>
                    + دفعة مختص
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {p.payments?.map((pay: any) => (
                <div key={pay.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3 text-sm">
                  <div>
                    <Badge color={pay.type === "client_in" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {pay.type === "client_in" ? "من العميل" : `للمختص ${pay.specialist?.name || ""}`}
                    </Badge>
                    <span className="text-xs text-slate-400 mr-2">{formatDate(pay.date)} · {pay.method || "—"}</span>
                  </div>
                  <div className="font-bold text-slate-700">{money(pay.amount)}</div>
                </div>
              ))}
              {(!p.payments || p.payments.length === 0) && <div className="text-sm text-slate-400">لا توجد دفعات</div>}
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">الملاحظات</h3>
            {canEdit && (
              <button className="btn-secondary text-xs" onClick={() => setModal("note")}>
                + ملاحظة
              </button>
            )}
          </div>
          <div className="space-y-2">
            {p.notes_list.map((n: any) => (
              <div key={n.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                <div className="text-slate-700">{n.text}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {n.author} · {formatDateTime(n.createdAt)}
                </div>
              </div>
            ))}
            {p.notes_list.length === 0 && <div className="text-sm text-slate-400">لا توجد ملاحظات</div>}
          </div>
        </Card>
      </div>

      {modal === "status" && <StatusModal project={p} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "specialist" && (
        <AssignSpecialistModal projectId={id!} specialists={specialists} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal === "file" && <UploadFileModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "note" && <NoteModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "clientPay" && <ClientPayModal projectId={id!} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "specPay" && (
        <SpecialistPayModal projectId={id!} specialists={p.specialists} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

async function downloadFile(fileId: number, name: string) {
  const res = await api.get(`/files/${fileId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusModal({ project, onClose, onSaved }: any) {
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(project.progress);
  const [err, setErr] = useState("");
  const all = [...PROJECT_STATUS_FLOW, "cancelled"];
  const save = async () => {
    try {
      await api.patch(`/projects/${project.id}/status`, { status, progress });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="تغيير حالة المشروع" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="الحالة">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {all.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-3">
        <Field label={`نسبة الإنجاز: ${progress}%`}>
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
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
    try {
      await api.post(`/projects/${projectId}/specialists`, form);
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="تعيين مختص">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="المختص" required>
          <select className="input" value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value })}>
            <option value="">اختر</option>
            {specialists.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="الدور">
          <input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </Field>
        <Field label="التكلفة المتفق عليها">
          <input type="number" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </Field>
        <Field label="موعد التسليم الداخلي">
          <input type="date" className="input" value={form.internalDeliveryDate} onChange={(e) => setForm({ ...form, internalDeliveryDate: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
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
    setSaving(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    if (name) fd.append("name", name);
    try {
      await api.post(`/projects/${projectId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSaving(false);
    }
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
      <div className="mt-3">
        <Field label="اسم وصفي (اختياري)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="الملف" required>
          <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "جارٍ الرفع..." : "رفع"}</button>
      </div>
    </Modal>
  );
}

function NoteModal({ projectId, onClose, onSaved }: any) {
  const [text, setText] = useState("");
  const [type, setType] = useState("general");
  const save = async () => {
    if (!text) return;
    await api.post(`/projects/${projectId}/notes`, { text, type });
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title="إضافة ملاحظة" size="sm">
      <Field label="النوع">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="general">عامة</option>
          <option value="edit">تعديل</option>
          <option value="internal">داخلية</option>
        </select>
      </Field>
      <div className="mt-3">
        <Field label="النص" required>
          <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function ClientPayModal({ projectId, onClose, onSaved }: any) {
  const [form, setForm] = useState({ amount: "", date: "", method: "", note: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      await api.post(`/financial/payments/client`, { ...form, projectId });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="دفعة من العميل" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="المبلغ" required>
        <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="التاريخ">
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <input className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function SpecialistPayModal({ projectId, specialists, onClose, onSaved }: any) {
  const [form, setForm] = useState({ specialistId: "", amount: "", date: "", method: "", note: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      await api.post(`/financial/payments/specialist`, { ...form, projectId });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    }
  };
  return (
    <Modal open onClose={onClose} title="دفعة لمختص" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="المختص" required>
        <select className="input" value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value })}>
          <option value="">اختر</option>
          {specialists.map((s: any) => (
            <option key={s.specialistId} value={s.specialistId}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="المبلغ" required>
        <input type="number" className="input mt-3" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="التاريخ">
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <input className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
