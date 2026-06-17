import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/ui";
import { formatDate, formatDateTime, PROJECT_STATUS_FLOW, statusLabel, STATUS_META } from "../lib/format";

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/public/projects/${token}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.message || "الرابط غير صالح"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-100">
        <Spinner />
      </div>
    );

  if (error || !data)
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-100 p-4">
        <div className="card p-10 text-center max-w-md">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <Icon name="alert" size={30} />
          </div>
          <h1 className="text-xl font-bold text-ink-800 mb-1">تعذّر فتح الرابط</h1>
          <p className="text-ink-500 text-sm">{error || "الرابط غير صالح أو تم إلغاؤه"}</p>
        </div>
      </div>
    );

  const { org, project: p, finance, payments, notes, files } = data;
  const cur = finance.currency || "ر.س";
  const fmt = (n: number) => `${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}`;
  const currentIdx = p.statusIndex;
  const paidPct = finance.value > 0 ? Math.min(100, Math.round((finance.paid / finance.value) * 100)) : 0;

  const download = async (id: number, name: string) => {
    const res = await api.get(`/public/projects/${token}/files/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-ink-100 bg-mesh">
      {/* Top bar */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center overflow-hidden">
              {org.logo ? <img src={org.logo} alt="logo" className="h-full w-full object-contain bg-white" /> : <Icon name="briefcase" size={20} className="text-white" />}
            </div>
            <div>
              <div className="font-bold text-ink-900 leading-tight">{org.name}</div>
              <div className="text-[11px] text-ink-400">بوابة متابعة المشروع</div>
            </div>
          </div>
          <span className="badge bg-brand-50 text-brand-700">{p.projectNumber}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Hero */}
        <div className="card p-6 animate-slide-up">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <StatusPill status={p.status} isLate={p.isLate} />
                {p.serviceType && <span className="badge bg-ink-100 text-ink-600">{p.serviceType}</span>}
              </div>
              <h1 className="text-2xl font-extrabold text-ink-900">{p.title}</h1>
              <p className="text-sm text-ink-500 mt-1">مرحباً {p.clientName} 👋 — هذه آخر حالة لمشروعك</p>
            </div>
            <div className="text-center bg-brand-50 rounded-2xl px-5 py-3">
              <div className="text-3xl font-extrabold text-brand-700">{p.progress}%</div>
              <div className="text-xs text-brand-600">نسبة الإنجاز</div>
            </div>
          </div>
          <div className="w-full bg-ink-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-brand-gradient h-2.5 rounded-full transition-all duration-700" style={{ width: `${p.progress}%` }} />
          </div>
        </div>

        {/* Timeline */}
        <div className="card p-6">
          <h2 className="font-bold text-ink-800 mb-4 flex items-center gap-2"><Icon name="activity" size={18} className="text-brand-600" /> مسار المشروع</h2>
          <div className="flex items-center overflow-x-auto pb-2">
            {PROJECT_STATUS_FLOW.map((s, i) => {
              const done = currentIdx >= i && p.status !== "cancelled";
              const active = currentIdx === i;
              return (
                <div key={s} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold ${active ? "bg-brand-gradient text-white shadow-glow ring-4 ring-brand-100" : done ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"}`}>
                      {done && !active ? <Icon name="check" size={15} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1.5 whitespace-nowrap ${done ? "text-ink-700 font-medium" : "text-ink-400"}`}>{statusLabel(s)}</span>
                  </div>
                  {i < PROJECT_STATUS_FLOW.length - 1 && <div className={`h-0.5 w-8 sm:w-12 mb-5 ${currentIdx > i ? "bg-brand-500" : "bg-ink-200"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard icon="calendar" tone="brand" label="تاريخ البدء" value={formatDate(p.startDate)} />
          <InfoCard icon="clock" tone={p.isLate ? "red" : "amber"} label="موعد التسليم" value={formatDate(p.deliveryDate)} />
          <InfoCard icon="money" tone="violet" label="موعد الاستحقاق" value={formatDate(finance.dueDate)} />
          <InfoCard icon="check" tone="green" label="تاريخ الإكمال" value={p.completedAt ? formatDate(p.completedAt) : "—"} />
        </div>

        {/* Financial */}
        <div className="card p-6">
          <h2 className="font-bold text-ink-800 mb-4 flex items-center gap-2"><Icon name="wallet" size={18} className="text-brand-600" /> الملخص المالي</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <FinBox label="إجمالي قيمة المشروع" value={fmt(finance.value)} tone="brand" />
            <FinBox label="المدفوع" value={fmt(finance.paid)} tone="green" />
            <FinBox label="المتبقي" value={fmt(finance.remaining)} tone="red" />
          </div>
          <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
            <span>نسبة السداد</span>
            <span className="font-bold">{paidPct}%</span>
          </div>
          <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${paidPct}%` }} />
          </div>
          {finance.invoiceNumber && (
            <div className="mt-3 text-xs text-ink-500">الفاتورة: <span className="font-semibold text-ink-700">{finance.invoiceNumber}</span></div>
          )}
        </div>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="card p-6">
            <h2 className="font-bold text-ink-800 mb-4 flex items-center gap-2"><Icon name="money" size={18} className="text-brand-600" /> سجل الدفعات</h2>
            <div className="space-y-2">
              {payments.map((pay: any) => (
                <div key={pay.id} className="flex items-center justify-between border border-ink-100 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Icon name="arrowDown" size={16} /></div>
                    <div>
                      <div className="text-sm font-semibold text-ink-800">دفعة مستلمة</div>
                      <div className="text-xs text-ink-400">{formatDate(pay.date)} {pay.method ? `· ${pay.method}` : ""}</div>
                    </div>
                  </div>
                  <div className="font-bold text-emerald-600">{fmt(pay.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <div className="card p-6">
            <h2 className="font-bold text-ink-800 mb-4 flex items-center gap-2"><Icon name="note" size={18} className="text-brand-600" /> ملاحظات</h2>
            <div className="space-y-2">
              {notes.map((n: any) => (
                <div key={n.id} className="border border-ink-100 rounded-xl p-3 bg-ink-50/40">
                  <div className="text-sm text-ink-700">{n.text}</div>
                  <div className="text-xs text-ink-400 mt-1">{formatDateTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div className="card p-6">
            <h2 className="font-bold text-ink-800 mb-4 flex items-center gap-2"><Icon name="file" size={18} className="text-brand-600" /> الملفات</h2>
            <div className="space-y-2">
              {files.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between border border-ink-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon name="file" size={18} /></div>
                    <div className="font-medium text-ink-800 truncate">{f.name}</div>
                  </div>
                  <button className="btn-secondary btn-sm" onClick={() => download(f.id, f.name)}><Icon name="download" size={15} /> تنزيل</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-sm text-ink-400">
          <div className="font-semibold text-ink-600">{org.name}</div>
          <div className="mt-1">{[org.phone, org.email].filter(Boolean).join(" · ")}</div>
        </div>
      </main>
    </div>
  );
}

function StatusPill({ status, isLate }: { status: string; isLate: boolean }) {
  const meta = isLate ? STATUS_META.late : STATUS_META[status] || { label: status, color: "bg-ink-100 text-ink-700", dot: "bg-ink-400" };
  return (
    <span className={`badge ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${(meta as any).dot}`} />
      {isLate ? "متأخر" : meta.label}
    </span>
  );
}

function InfoCard({ icon, label, value, tone }: any) {
  const tones: any = { brand: "bg-brand-50 text-brand-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600", green: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600" };
  return (
    <div className="card !p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${tones[tone]}`}><Icon name={icon} size={17} /></div>
      <div className="text-sm font-bold text-ink-800">{value}</div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}

function FinBox({ label, value, tone }: any) {
  const tones: any = { brand: "text-brand-700", green: "text-emerald-600", red: "text-red-600" };
  return (
    <div className="bg-ink-50 rounded-xl p-4 text-center">
      <div className={`text-xl font-extrabold ${tones[tone]}`}>{value}</div>
      <div className="text-xs text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}
