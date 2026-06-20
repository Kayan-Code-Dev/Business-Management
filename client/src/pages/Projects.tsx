import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, StatusBadge, Progress, EmptyState, Modal, Field, TableSkeleton } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate, PROJECT_STATUS_FLOW, STATUS_META, statusLabel } from "../lib/format";
import { useLookups } from "../lib/useLookups";
import { useToast } from "../lib/toast";

const STATUS_FILTERS = ["all", ...PROJECT_STATUS_FLOW, "late", "cancelled"];
const SORTS = [
  { key: "newest", label: "الأحدث" },
  { key: "delivery", label: "موعد التسليم" },
  { key: "value", label: "القيمة (الأعلى)" },
  { key: "progress", label: "نسبة الإنجاز" },
];

export default function Projects() {
  const { can, flag } = useAuth();
  const { byCategory } = useLookups();
  const { notify } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");
  const [modal, setModal] = useState<any>(null);

  const load = () => {
    setLoading(true);
    const params: any = { archived };
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    if (serviceType !== "all") params.serviceType = serviceType;
    api.get("/projects", { params }).then((res) => setProjects(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, serviceType, archived]);
  useEffect(() => { if (can("clients", "view")) api.get("/clients").then((res) => setClients(res.data)); }, []);

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      if (sort === "delivery") return new Date(a.deliveryDate || "2999").getTime() - new Date(b.deliveryDate || "2999").getTime();
      if (sort === "value") return (b.value || 0) - (a.value || 0);
      if (sort === "progress") return (b.progress || 0) - (a.progress || 0);
      return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
    });
    return arr;
  }, [projects, sort]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => !["completed", "cancelled"].includes(p.status)).length;
    const late = projects.filter((p) => p.isLate).length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const value = projects.reduce((s, p) => s + (p.value || 0), 0);
    return { total, active, late, completed, value };
  }, [projects]);

  const changeStatus = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/projects/${id}/status`, { status: newStatus });
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
      notify("تم تحديث حالة المشروع");
      load();
    } catch (e) {
      notify(apiError(e), "error");
    }
  };

  const toggleArchive = async (p: any) => {
    try {
      await api.patch(`/projects/${p.id}/archive`, { archived: !archived });
      notify(archived ? "تم إلغاء الأرشفة" : "تمت الأرشفة");
      load();
    } catch (e) {
      notify(apiError(e), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="المشاريع"
        subtitle="إدارة ومتابعة جميع المشاريع"
        icon="projects"
        actions={
          can("projects", "create") && (
            <button className="btn-primary" onClick={() => setModal({ mode: "create" })}>
              <Icon name="plus" size={18} /> مشروع جديد
            </button>
          )
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <MiniStat label="الإجمالي" value={stats.total} icon="briefcase" tone="brand" />
        <MiniStat label="نشطة" value={stats.active} icon="activity" tone="violet" />
        <MiniStat label="متأخرة" value={stats.late} icon="clock" tone="red" />
        <MiniStat label="مكتملة" value={stats.completed} icon="check" tone="green" />
        {flag("viewProfits") && <MiniStat label="إجمالي القيمة" value={money(stats.value)} icon="money" tone="amber" />}
      </div>

      {/* Toolbar */}
      <Card className="mb-5 !p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
              <Icon name="search" size={18} />
            </span>
            <input
              className="input pr-10"
              placeholder="بحث برقم المشروع، العنوان، العميل، المختص..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s === "all" ? "كل الحالات" : statusLabel(s)}</option>
              ))}
            </select>
            <select className="input !w-auto" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
              <option value="all">كل الخدمات</option>
              {byCategory("service_type").map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>ترتيب: {s.label}</option>
              ))}
            </select>
            <button
              className={`btn-secondary !px-3 ${archived ? "!bg-brand-50 !border-brand-300 !text-brand-700" : ""}`}
              onClick={() => setArchived((a) => !a)}
              title="الأرشيف"
            >
              <Icon name="archive" size={18} />
            </button>
            <div className="flex rounded-xl border border-ink-200 bg-ink-50 p-0.5">
              <button
                className={`px-2.5 py-1.5 rounded-lg transition ${view === "table" ? "bg-white shadow-card text-brand-600" : "text-ink-400"}`}
                onClick={() => setView("table")}
                title="جدول"
              >
                <Icon name="list" size={18} />
              </button>
              <button
                className={`px-2.5 py-1.5 rounded-lg transition ${view === "board" ? "bg-white shadow-card text-brand-600" : "text-ink-400"}`}
                onClick={() => setView("board")}
                title="بورد"
              >
                <Icon name="board" size={18} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><TableSkeleton rows={6} cols={6} /></Card>
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState
            message={archived ? "لا توجد مشاريع مؤرشفة" : "لا توجد مشاريع مطابقة"}
            icon="projects"
            action={can("projects", "create") && !archived && (
              <button className="btn-primary" onClick={() => setModal({ mode: "create" })}>
                <Icon name="plus" size={18} /> أضف أول مشروع
              </button>
            )}
          />
        </Card>
      ) : view === "table" ? (
        <TableView
          projects={sorted}
          flag={flag}
          canEdit={can("projects", "edit")}
          onEdit={(p: any) => setModal({ mode: "edit", project: p })}
          onArchive={toggleArchive}
          archived={archived}
        />
      ) : (
        <BoardView projects={sorted} canEdit={can("projects", "edit")} onMove={changeStatus} flag={flag} />
      )}

      {modal && (
        <ProjectModal
          mode={modal.mode}
          project={modal.project}
          clients={clients}
          serviceTypes={byCategory("service_type")}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            notify(modal.mode === "create" ? "تم إنشاء المشروع" : "تم حفظ التعديلات");
            load();
          }}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, tone }: any) {
  const tones: any = {
    brand: "bg-brand-50 text-brand-600",
    violet: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="card !p-3.5 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-extrabold text-ink-900 truncate">{value}</div>
        <div className="text-xs text-ink-500">{label}</div>
      </div>
    </div>
  );
}

function TableView({ projects, flag, canEdit, onEdit, onArchive, archived }: any) {
  return (
    <Card className="!p-0 overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>رقم</th>
              <th>المشروع</th>
              <th>العميل</th>
              <th>المختصون</th>
              <th>الحالة</th>
              <th>تاريخ الإنشاء</th>
              <th>التسليم</th>
              <th>الملاحظات</th>
              <th>الملفات</th>
              <th>التقدّم</th>
              <th>القيمة</th>
              <th>المتبقي</th>
              {flag("viewProfits") && <th>الربح المتوقع</th>}
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <Link className="text-brand-600 hover:underline font-bold" to={`/projects/${p.id}`}>{p.projectNumber}</Link>
                </td>
                <td className="max-w-[200px] truncate font-medium text-ink-800">{p.title}</td>
                <td>{p.client?.name}</td>
                <td className="text-xs text-ink-500">{p.specialists?.map((s: any) => s.name).join("، ") || "—"}</td>
                <td><StatusBadge status={p.status} isLate={p.isLate} /></td>
                <td className="text-sm whitespace-nowrap">{formatDate(p.createdAt)}</td>
                <td className="text-sm whitespace-nowrap">{formatDate(p.deliveryDate)}</td>
                <td>
                  <span className="badge bg-amber-50 text-amber-700">{p.notesCount || 0}</span>
                </td>
                <td>
                  <span className="badge bg-blue-50 text-blue-700">{p.filesCount || 0}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Progress value={p.progress} />
                    <span className="text-xs text-ink-400 w-8">{p.progress}%</span>
                  </div>
                </td>
                <td className="font-semibold">{money(p.value)}</td>
                <td className={p.clientRemaining > 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{money(p.clientRemaining)}</td>
                {flag("viewProfits") && <td className="text-brand-700 font-bold">{money(p.expectedProfit)}</td>}
                {canEdit && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-brand-600 transition" onClick={() => onEdit(p)} title="تعديل">
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-amber-600 transition" onClick={() => onArchive(p)} title={archived ? "إلغاء الأرشفة" : "أرشفة"}>
                        <Icon name="archive" size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BoardView({ projects, canEdit, onMove, flag }: any) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
      {PROJECT_STATUS_FLOW.map((col) => {
        const items = projects.filter((p: any) => p.status === col);
        const meta = STATUS_META[col];
        return (
          <div
            key={col}
            className={`shrink-0 w-72 rounded-2xl bg-ink-50/70 border-2 transition ${overCol === col ? "border-brand-400 bg-brand-50/50" : "border-transparent"}`}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOverCol(col); } }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => {
              setOverCol(null);
              if (canEdit && dragId != null) {
                const p = projects.find((x: any) => x.id === dragId);
                if (p && p.status !== col) onMove(dragId, col);
              }
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-3 sticky top-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <span className="font-bold text-sm text-ink-700">{meta.label}</span>
              </div>
              <span className="badge bg-white text-ink-500 border border-ink-200">{items.length}</span>
            </div>
            <div className="px-2.5 pb-2.5 space-y-2.5 min-h-[120px]">
              {items.map((p: any) => (
                <Link
                  to={`/projects/${p.id}`}
                  key={p.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  className={`block bg-white rounded-xl border border-ink-200 p-3 shadow-card hover:shadow-soft transition ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === p.id ? "opacity-50" : ""} border-r-4 ${meta.accent}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-brand-600">{p.projectNumber}</span>
                    {p.isLate && <span className="badge bg-red-50 text-red-600">متأخر</span>}
                  </div>
                  <div className="font-semibold text-sm text-ink-800 line-clamp-2 mb-2">{p.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-2">
                    <Icon name="user" size={13} /> {p.client?.name}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Progress value={p.progress} />
                    <span className="text-[11px] text-ink-400">{p.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-500 flex items-center gap-1"><Icon name="calendar" size={12} /> {formatDate(p.deliveryDate)}</span>
                    {flag("viewProfits") && <span className="font-bold text-ink-700">{money(p.value)}</span>}
                  </div>
                </Link>
              ))}
              {items.length === 0 && <div className="text-center text-xs text-ink-300 py-6">— فارغ —</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectModal({ mode, project, clients, serviceTypes, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    title: project?.title || "",
    projectNumber: project?.projectNumber || "",
    clientId: project?.client?.id || "",
    serviceType: project?.serviceType || "",
    priority: project?.priority || "medium",
    clientSource: project?.clientSource || "",
    description: project?.description || "",
    value: project?.value ?? "",
    deliveryDate: project?.deliveryDate ? String(project.deliveryDate).slice(0, 10) : "",
    progress: project?.progress ?? 0,
    notes: project?.notes || "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const uploadInitialFiles = async (projectId: number) => {
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("name", f.name);
      fd.append("category", "general");
      await api.post(`/projects/${projectId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    }
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      if (mode === "edit") {
        await api.put(`/projects/${project.id}`, form);
      } else {
        const res = await api.post("/projects", form);
        if (files.length > 0) await uploadInitialFiles(res.data.id);
      }
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "تعديل المشروع" : "مشروع جديد"} subtitle={mode === "edit" ? project.projectNumber : "أدخل بيانات المشروع الأساسية"} size="lg">
      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="عنوان المشروع" required>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
        </div>
        {mode === "create" && (
          <Field label="رقم المشروع" hint="يُولّد تلقائياً إن تُرك فارغاً">
            <input className="input" value={form.projectNumber} onChange={(e) => setForm({ ...form, projectNumber: e.target.value })} />
          </Field>
        )}
        <Field label="العميل" required>
          <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">اختر العميل</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="نوع الخدمة">
          <select className="input" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
            <option value="">اختر النوع</option>
            {serviceTypes.map((s: any) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="الأولوية">
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
            <option value="urgent">عاجلة</option>
          </select>
        </Field>
        <Field label="مصدر العميل">
          <select className="input" value={form.clientSource} onChange={(e) => setForm({ ...form, clientSource: e.target.value })}>
            <option value="">اختر المصدر</option>
            <option value="facebook">فيسبوك</option>
            <option value="instagram">إنستغرام</option>
            <option value="whatsapp">واتساب</option>
            <option value="website">موقع إلكتروني</option>
            <option value="referral">توصية</option>
            <option value="other">أخرى</option>
          </select>
        </Field>
        <Field label="قيمة المشروع">
          <input type="number" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </Field>
        <Field label="موعد التسليم">
          <input type="date" className="input" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
        </Field>
        {mode === "edit" && (
          <Field label={`نسبة الإنجاز: ${form.progress}%`}>
            <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-brand-600" />
          </Field>
        )}
        <div className="md:col-span-2">
          <Field label="وصف المشروع">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="ملاحظات">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        {mode === "create" && (
          <div className="md:col-span-2">
            <Field label="رفع ملفات المشروع الأساسية">
              <input
                type="file"
                className="input"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </Field>
            {files.length > 0 && <p className="text-xs text-ink-500 mt-1">سيتم رفع {files.length} ملف بعد إنشاء المشروع.</p>}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
      </div>
    </Modal>
  );
}
