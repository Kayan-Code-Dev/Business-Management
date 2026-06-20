import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatusBadge, EmptyState, Progress, Field, Modal, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate, formatDateTime } from "../lib/format";
import { useToast } from "../lib/toast";

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

const DEGREE_LABELS: Record<string, string> = {
  bachelor: "بكالوريوس",
  master: "ماجستير",
  phd: "دكتوراه",
};

export default function ClientDetail() {
  const { id } = useParams();
  const { flag, can } = useAuth();
  const { notify } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("projects");
  const [showFileModal, setShowFileModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = () =>
    api
      .get(`/clients/${id}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [id]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/clients/${id}/notes`, { text: noteText.trim() });
      setNoteText("");
      notify("تمت إضافة الملاحظة");
      load();
    } catch (e) {
      notify(apiError(e), "error");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: number) => {
    if (!confirm("حذف الملاحظة؟")) return;
    try {
      await api.delete(`/clients/${id}/notes/${noteId}`);
      notify("تم حذف الملاحظة");
      load();
    } catch (e) {
      notify(apiError(e), "error");
    }
  };

  const deleteFile = async (fileId: number) => {
    if (!confirm("حذف الملف؟")) return;
    try {
      await api.delete(`/clients/${id}/files/${fileId}`);
      notify("تم حذف الملف");
      load();
    } catch (e) {
      notify(apiError(e), "error");
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="العميل غير موجود" />;

  const tabs = [
    { key: "projects", label: "المشاريع", icon: "projects", count: data.projects.length },
    { key: "payments", label: "الدفعات", icon: "money", count: data.payments.length },
    { key: "files", label: "ملفات العميل", icon: "file", count: data.files.length },
    { key: "notes", label: "ملاحظات داخلية", icon: "note", count: data.notesList.length },
  ];

  return (
    <div>
      <PageHeader
        title={data.name}
        subtitle={`${data.phone || ""} ${data.country ? "· " + data.country : ""}`}
        icon="clients"
        actions={
          <div className="flex gap-2">
            <Link to="/clients" className="btn-secondary">
              <Icon name="chevronRight" size={16} /> رجوع
            </Link>
            {can("clients", "edit") && (
              <button className="btn-secondary" onClick={() => setShowFileModal(true)}>
                <Icon name="upload" size={16} /> رفع ملف
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
        <Card className="!p-4">
          <div className="text-sm text-slate-500">عدد المشاريع</div>
          <div className="text-xl font-bold">{data.summary.projectsCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">المشاريع النشطة</div>
          <div className="text-xl font-bold text-brand-700">{data.summary.activeProjects}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">المشاريع المكتملة</div>
          <div className="text-xl font-bold text-green-600">{data.summary.completedProjects}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">إجمالي القيمة</div>
          <div className="text-xl font-bold">{money(data.summary.totalValue)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">إجمالي المدفوع</div>
          <div className="text-xl font-bold text-green-600">{money(data.summary.totalPaid)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">المتبقي</div>
          <div className="text-xl font-bold text-red-600">{money(data.summary.totalRemaining)}</div>
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="font-bold text-ink-900 mb-3">بيانات العميل الأساسية</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoItem label="الاسم" value={data.name} />
          <InfoItem label="الهاتف" value={data.phone || "—"} />
          <InfoItem label="البريد الإلكتروني" value={data.email || "—"} />
          <InfoItem label="الدولة" value={data.country || "—"} />
          <InfoItem label="الجامعة" value={data.university || "—"} />
          <InfoItem label="التخصص" value={data.specialization || "—"} />
          <InfoItem label="الدرجة العلمية" value={DEGREE_LABELS[data.academicDegree] || data.academicDegree || "—"} />
          <InfoItem label="تاريخ الإنشاء" value={formatDate(data.createdAt)} />
          <InfoItem label="المصدر" value={SOURCE_LABELS[data.source] || data.source || "—"} />
          <div className="rounded-xl border border-ink-100 p-3 bg-white">
            <div className="text-xs text-ink-500 mb-1">الحالة</div>
            <Badge color={STATUS_META[data.status]?.color || "bg-ink-100 text-ink-700"}>
              {STATUS_META[data.status]?.label || data.status}
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="flex border-b border-ink-100 overflow-x-auto">
          {tabs.map((t: any) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
                tab === t.key ? "border-brand-600 text-brand-700 bg-brand-50/40" : "border-transparent text-ink-500"
              }`}
            >
              <Icon name={t.icon} size={16} /> {t.label}
              <span className={`badge ${tab === t.key ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "projects" && (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>رقم</th>
                    <th>المشروع</th>
                    <th>الحالة</th>
                    <th>نسبة الإنجاز</th>
                    <th>التسليم</th>
                    <th>المختص المسؤول</th>
                    <th>القيمة</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    {flag("viewProfits") && <th>الربح</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="text-brand-600 hover:underline" to={`/projects/${p.id}`}>
                          {p.projectNumber}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate">{p.title}</td>
                      <td>
                        <StatusBadge status={p.status} isLate={p.isLate} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress || 0} />
                          <span className="text-xs text-ink-500">{p.progress || 0}%</span>
                        </div>
                      </td>
                      <td>{formatDate(p.deliveryDate)}</td>
                      <td>{p.responsibleSpecialist || "—"}</td>
                      <td>{money(p.value)}</td>
                      <td className="text-green-600">{money(p.clientPaid)}</td>
                      <td className={p.clientRemaining > 0 ? "text-red-600" : ""}>{money(p.clientRemaining)}</td>
                      {flag("viewProfits") && <td className="text-brand-700">{money(p.netProfit)}</td>}
                    </tr>
                  ))}
                  {data.projects.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState message="لا توجد مشاريع" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "payments" && (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المبلغ</th>
                    <th>طريقة الدفع</th>
                    <th>المشروع المرتبط</th>
                    <th>ملاحظات العملية</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>{formatDateTime(p.date)}</td>
                      <td className="text-green-600 font-medium">{money(p.amount)}</td>
                      <td>{p.method || "—"}</td>
                      <td>{p.project?.projectNumber ? `${p.project.projectNumber} · ${p.project.title || ""}` : "—"}</td>
                      <td>{p.note || "—"}</td>
                    </tr>
                  ))}
                  {data.payments.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="لا توجد دفعات" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-2">
              {data.files.map((f: any) => (
                <div key={f.id} className="rounded-xl border border-ink-100 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-800 truncate">{f.name}</div>
                    <div className="text-xs text-ink-500">
                      {f.uploadedBy || "—"} · {formatDateTime(f.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                      onClick={() => downloadClientFile(id!, f.id, f.name)}
                    >
                      <Icon name="download" size={16} />
                    </button>
                    {can("clients", "edit") && (
                      <button
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deleteFile(f.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {data.files.length === 0 && <EmptyState message="لا توجد ملفات للعميل" />}
            </div>
          )}

          {tab === "notes" && (
            <div className="space-y-3">
              {can("clients", "edit") && (
                <div className="rounded-xl border border-ink-100 p-3">
                  <Field label="ملاحظة داخلية">
                    <textarea className="input" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  </Field>
                  <div className="flex justify-end mt-2">
                    <button className="btn-primary btn-sm" onClick={addNote} disabled={savingNote}>
                      {savingNote ? "..." : "إضافة"}
                    </button>
                  </div>
                </div>
              )}
              {data.notesList.map((n: any) => (
                <div key={n.id} className="rounded-xl border border-ink-100 p-3 bg-white">
                  <div className="text-sm text-ink-700 whitespace-pre-wrap">{n.text}</div>
                  <div className="text-xs text-ink-400 mt-1 flex items-center justify-between">
                    <span>
                      {n.author || "النظام"} · {formatDateTime(n.createdAt)}
                    </span>
                    {can("clients", "edit") && (
                      <button className="text-red-500 hover:underline" onClick={() => deleteNote(n.id)}>
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {data.notesList.length === 0 && <EmptyState message="لا توجد ملاحظات داخلية" />}
            </div>
          )}
        </div>
      </Card>

      {showFileModal && (
        <UploadClientFileModal
          clientId={id!}
          onClose={() => setShowFileModal(false)}
          onSaved={() => {
            setShowFileModal(false);
            notify("تم رفع الملف");
            load();
          }}
        />
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 p-3 bg-white">
      <div className="text-xs text-ink-500 mb-1">{label}</div>
      <div className="font-semibold text-ink-800">{value || "—"}</div>
    </div>
  );
}

function UploadClientFileModal({ clientId, onClose, onSaved }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!file) return setErr("اختر ملفاً");
    setSaving(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (name) fd.append("name", name);
      await api.post(`/clients/${clientId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="رفع ملف للعميل" size="sm">
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <Field label="اسم الملف (اختياري)">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="mt-3">
        <Field label="الملف" required>
          <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "جارٍ الرفع..." : "رفع"}
        </button>
      </div>
    </Modal>
  );
}

async function downloadClientFile(clientId: string, fileId: number, name: string) {
  const res = await api.get(`/clients/${clientId}/files/${fileId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
