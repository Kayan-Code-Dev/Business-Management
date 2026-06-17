import { useEffect, useMemo, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, Spinner, Modal, Field, EmptyState } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate } from "../lib/format";
import { useToast } from "../lib/toast";

export const STAGES = [
  { key: "new", label: "جديدة", dot: "bg-slate-400", accent: "border-slate-400" },
  { key: "contacted", label: "تم التواصل", dot: "bg-blue-500", accent: "border-blue-400" },
  { key: "qualified", label: "مؤهّلة", dot: "bg-indigo-500", accent: "border-indigo-400" },
  { key: "proposal", label: "عرض سعر", dot: "bg-violet-500", accent: "border-violet-400" },
  { key: "negotiation", label: "تفاوض", dot: "bg-amber-500", accent: "border-amber-400" },
  { key: "won", label: "رابحة", dot: "bg-emerald-500", accent: "border-emerald-400" },
  { key: "lost", label: "خاسرة", dot: "bg-red-500", accent: "border-red-400" },
];
const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label || k;

export default function Pipeline() {
  const { can } = useAuth();
  const { notify } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const canEdit = can("pipeline", "edit");

  const load = () => {
    setLoading(true);
    api.get("/leads", { params: search ? { search } : {} }).then((r) => setLeads(r.data)).finally(() => setLoading(false));
    api.get("/leads/stats").then((r) => setStats(r.data)).catch(() => {});
  };
  useEffect(() => {
    load();
    api.get("/leads/owners").then((r) => setOwners(r.data)).catch(() => {});
  }, []);

  const moveStage = async (id: number, stage: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      await api.patch(`/leads/${id}/stage`, { stage });
      notify(`نُقلت إلى: ${stageLabel(stage)}`);
      load();
    } catch (e) {
      notify(apiError(e), "error");
      load();
    }
  };

  return (
    <div>
      <PageHeader
        title="خطوط الأنابيب"
        subtitle="إدارة الفرص البيعية لفريق المبيعات"
        icon="trendUp"
        actions={canEdit && <button className="btn-primary" onClick={() => setModal({ mode: "create" })}><Icon name="plus" size={18} /> فرصة جديدة</button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <MiniStat label="قيمة الفرص المفتوحة" value={money(stats.openValue)} icon="wallet" tone="brand" sub={`${stats.openCount} فرصة`} />
          <MiniStat label="أُبرمت هذا الشهر" value={money(stats.wonThisMonth)} icon="trendUp" tone="green" sub={`${stats.wonCount} إجمالاً`} />
          <MiniStat label="معدّل التحويل" value={`${stats.conversionRate}%`} icon="activity" tone="violet" />
          <MiniStat label="فرص خاسرة" value={stats.lostCount} icon="close" tone="red" />
        </div>
      )}

      <Card className="mb-5 !p-3">
        <div className="relative max-w-md">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"><Icon name="search" size={18} /></span>
          <input className="input pr-10" placeholder="بحث بالعنوان أو اسم العميل أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : (
        <Board leads={leads} canEdit={canEdit} onMove={moveStage} onOpen={(l: any) => setModal({ mode: "edit", id: l.id })} />
      )}

      {modal && (
        <LeadModal
          mode={modal.mode}
          id={modal.id}
          owners={owners}
          canEdit={canEdit}
          canDelete={can("pipeline", "delete")}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          notify={notify}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, tone, sub }: any) {
  const tones: any = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600", red: "bg-red-50 text-red-600" };
  return (
    <div className="card !p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon name={icon} size={20} /></div>
      <div className="min-w-0">
        <div className="text-lg font-extrabold text-ink-900 truncate">{value}</div>
        <div className="text-xs text-ink-500">{label}{sub ? ` · ${sub}` : ""}</div>
      </div>
    </div>
  );
}

function Board({ leads, canEdit, onMove, onOpen }: any) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    STAGES.forEach((s) => (map[s.key] = []));
    leads.forEach((l: any) => (map[l.stage] = map[l.stage] || []).push(l));
    return map;
  }, [leads]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
      {STAGES.map((col) => {
        const items = byStage[col.key] || [];
        const total = items.reduce((s: number, l: any) => s + (l.value || 0), 0);
        return (
          <div
            key={col.key}
            className={`shrink-0 w-72 rounded-2xl bg-ink-50/70 border-2 transition ${over === col.key ? "border-brand-400 bg-brand-50/50" : "border-transparent"}`}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(col.key); } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (canEdit && dragId != null) { const l = leads.find((x: any) => x.id === dragId); if (l && l.stage !== col.key) onMove(dragId, col.key); } setDragId(null); }}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className="font-bold text-sm text-ink-700">{col.label}</span>
                <span className="badge bg-white text-ink-500 border border-ink-200">{items.length}</span>
              </div>
              <span className="text-xs text-ink-400">{money(total)}</span>
            </div>
            <div className="px-2.5 pb-2.5 space-y-2.5 min-h-[120px]">
              {items.map((l: any) => (
                <div
                  key={l.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => { setDragId(null); setOver(null); }}
                  onClick={() => onOpen(l)}
                  className={`bg-white rounded-xl border border-ink-200 p-3 shadow-card hover:shadow-soft transition cursor-pointer border-r-4 ${col.accent} ${dragId === l.id ? "opacity-50" : ""}`}
                >
                  <div className="font-semibold text-sm text-ink-800 line-clamp-2 mb-1.5">{l.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-2"><Icon name="user" size={13} /> {l.clientName}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-brand-700">{money(l.value)}</span>
                    {l.owner && <span className="badge bg-ink-100 text-ink-500">{l.owner.name?.split(" ")[0]}</span>}
                  </div>
                  {l.expectedCloseDate && <div className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1"><Icon name="calendar" size={11} /> {formatDate(l.expectedCloseDate)}</div>}
                </div>
              ))}
              {items.length === 0 && <div className="text-center text-xs text-ink-300 py-6">— فارغ —</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadModal({ mode, id, owners, canEdit, canDelete, onClose, onSaved, notify }: any) {
  const [form, setForm] = useState<any>({ title: "", clientName: "", phone: "", email: "", source: "", value: "", stage: "new", expectedCloseDate: "", notes: "", ownerId: "" });
  const [lead, setLead] = useState<any>(null);
  const [leadNotes, setLeadNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(mode !== "edit");

  useEffect(() => {
    if (mode === "edit" && id) {
      api.get(`/leads/${id}`).then((r) => {
        const l = r.data;
        setLead(l);
        setLeadNotes(l.leadNotes || []);
        setForm({
          title: l.title, clientName: l.clientName, phone: l.phone || "", email: l.email || "", source: l.source || "",
          value: l.value, stage: l.stage, expectedCloseDate: l.expectedCloseDate ? l.expectedCloseDate.slice(0, 10) : "",
          notes: l.notes || "", ownerId: l.ownerId || "", lostReason: l.lostReason || "",
        });
        setReady(true);
      });
    }
  }, []);

  const save = async () => {
    setError("");
    if (!form.title || !form.clientName) return setError("العنوان واسم العميل مطلوبان");
    setSaving(true);
    try {
      if (mode === "edit") await api.put(`/leads/${id}`, form);
      else await api.post("/leads", form);
      notify(mode === "edit" ? "تم حفظ الفرصة" : "تمت إضافة الفرصة");
      onSaved();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const res = await api.post(`/leads/${id}/notes`, { text: newNote });
    setLeadNotes([{ ...res.data, author: { name: "أنت" } }, ...leadNotes]);
    setNewNote("");
  };

  const convert = async (createProject: boolean) => {
    if (!confirm(createProject ? "تحويل الفرصة إلى عميل ومشروع؟" : "تحويل الفرصة إلى عميل؟")) return;
    try {
      await api.post(`/leads/${id}/convert`, { createProject });
      notify("تم تحويل الفرصة بنجاح");
      onSaved();
    } catch (e) {
      notify(apiError(e), "error");
    }
  };

  const del = async () => {
    if (!confirm("حذف الفرصة؟")) return;
    await api.delete(`/leads/${id}`);
    notify("تم الحذف");
    onSaved();
  };

  if (!ready) return <Modal open onClose={onClose} title="تحميل..."><Spinner /></Modal>;

  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "تفاصيل الفرصة" : "فرصة بيعية جديدة"} size="lg">
      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Field label="عنوان الفرصة" required><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
        <Field label="اسم العميل" required><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></Field>
        <Field label="الهاتف"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="البريد"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="المصدر"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="إعلان، توصية..." /></Field>
        <Field label="القيمة المتوقعة"><input type="number" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
        <Field label="المرحلة">
          <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الإغلاق المتوقع"><input type="date" className="input" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} /></Field>
        <Field label="المسؤول">
          <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
            <option value="">غير محدد</option>
            {owners.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        {form.stage === "lost" && (
          <div className="md:col-span-2"><Field label="سبب الخسارة"><input className="input" value={form.lostReason || ""} onChange={(e) => setForm({ ...form, lostReason: e.target.value })} /></Field></div>
        )}
        <div className="md:col-span-2"><Field label="ملاحظات"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      </div>

      {/* Follow-ups (edit mode) */}
      {mode === "edit" && (
        <div className="mt-5 border-t border-ink-100 pt-4">
          <h4 className="font-semibold text-ink-700 mb-2 flex items-center gap-2"><Icon name="note" size={16} /> سجل المتابعات</h4>
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="أضف متابعة (مكالمة، اجتماع، ملاحظة)..." value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
            <button className="btn-secondary shrink-0" onClick={addNote}><Icon name="plus" size={16} /></button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {leadNotes.map((n: any) => (
              <div key={n.id} className="border border-ink-100 rounded-lg p-2.5 text-sm">
                <div className="text-ink-700">{n.text}</div>
                <div className="text-xs text-ink-400 mt-0.5">{n.author?.name || "—"} · {formatDate(n.createdAt)}</div>
              </div>
            ))}
            {leadNotes.length === 0 && <div className="text-xs text-ink-400">لا توجد متابعات بعد</div>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 mt-6">
        <div className="flex gap-2">
          {mode === "edit" && canEdit && lead?.stage !== "won" && (
            <>
              <button className="btn-secondary" onClick={() => convert(false)}><Icon name="clients" size={15} /> تحويل لعميل</button>
              <button className="btn-secondary" onClick={() => convert(true)}><Icon name="projects" size={15} /> تحويل لمشروع</button>
            </>
          )}
          {mode === "edit" && canDelete && <button className="btn-ghost text-red-500" onClick={del}><Icon name="trash" size={15} /> حذف</button>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>إغلاق</button>
          {canEdit && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "..." : "حفظ"}</button>}
        </div>
      </div>
    </Modal>
  );
}
