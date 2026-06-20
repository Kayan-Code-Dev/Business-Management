import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Spinner, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { formatDate } from "../lib/format";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/toast";
import { INVOICE_STATUS } from "./Invoices";

export default function InvoiceView() {
  const { id } = useParams();
  const { can } = useAuth();
  const { org } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => api.get(`/invoices/${id}`).then((r) => setInv(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  if (loading) return <Spinner />;
  if (!inv) return <div className="text-center py-16 text-ink-400">الفاتورة غير موجودة</div>;

  const cur = inv.currency || org.currency || "ر.س";
  const fmt = (n: number) => `${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  const setStatus = async (status: string) => {
    await api.patch(`/invoices/${id}/status`, { status });
    notify("تم تحديث حالة الفاتورة");
    load();
  };

  return (
    <div className="animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <Link to="/invoices" className="btn-secondary"><Icon name="chevronRight" size={16} /> رجوع للفواتير</Link>
        <div className="flex flex-wrap items-center gap-2">
          {can("financial", "edit") && (
            <select className="input !w-auto" value={inv.status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          {can("financial", "edit") && inv.status !== "paid" && (
            <button className="btn-secondary" onClick={() => setStatus("paid")}><Icon name="check" size={16} /> تحديد كمدفوعة</button>
          )}
          <button className="btn-primary" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة / حفظ PDF</button>
        </div>
      </div>

      {/* Invoice document */}
      <div className="invoice-doc mx-auto max-w-4xl bg-white rounded-2xl shadow-soft border border-ink-200 overflow-hidden print:shadow-none print:border-0">
        {/* Header */}
        <div className="relative bg-sidebar-gradient text-white px-8 py-7">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {org.logo ? (
                <div className="h-16 w-16 rounded-2xl bg-white p-1.5 shrink-0">
                  <img src={org.logo} alt="logo" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center shrink-0">
                  <Icon name="briefcase" size={30} className="text-brand-200" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-extrabold">{org.name || "شركتي"}</h1>
                <div className="text-indigo-200/80 text-sm mt-1 space-y-0.5">
                  {org.address && <div className="flex items-center gap-1.5"><Icon name="building" size={13} /> {org.address}</div>}
                  {org.phone && <div className="flex items-center gap-1.5"><Icon name="phone" size={13} /> {org.phone}</div>}
                  {org.email && <div className="flex items-center gap-1.5"><Icon name="mail" size={13} /> {org.email}</div>}
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-3xl font-extrabold tracking-tight">فاتورة</div>
              <div className="text-indigo-200/70 text-xs tracking-[0.3em] uppercase">Invoice</div>
              <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 backdrop-blur">
                <div className="font-bold text-lg">{inv.invoiceNumber}</div>
                <span className={`badge mt-1 ${INVOICE_STATUS[inv.status]?.color}`}>{INVOICE_STATUS[inv.status]?.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="px-8 py-6 grid sm:grid-cols-2 gap-6 border-b border-ink-100">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">فاتورة إلى</div>
            <div className="font-bold text-ink-900 text-lg">{inv.client?.name}</div>
            <div className="text-sm text-ink-500 mt-1 space-y-0.5">
              {inv.client?.phone && <div>{inv.client.phone}</div>}
              {inv.client?.country && <div>{inv.client.country}</div>}
              {inv.project && <div className="text-brand-600">المشروع: {inv.project.projectNumber} - {inv.project.title}</div>}
            </div>
          </div>
          <div className="sm:text-left">
            <div className="inline-grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <span className="text-ink-400">تاريخ الإصدار</span>
              <span className="font-semibold text-ink-800">{formatDate(inv.issueDate)}</span>
              <span className="text-ink-400">تاريخ الاستحقاق</span>
              <span className="font-semibold text-ink-800">{formatDate(inv.dueDate)}</span>
              {org.taxNumber && (<><span className="text-ink-400">الرقم الضريبي</span><span className="font-semibold text-ink-800">{org.taxNumber}</span></>)}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="px-8 py-6">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-white">
                <th className="bg-brand-600 rounded-r-lg px-4 py-3 text-right font-semibold w-10">#</th>
                <th className="bg-brand-600 px-4 py-3 text-right font-semibold">الوصف</th>
                <th className="bg-brand-600 px-4 py-3 text-center font-semibold w-20">الكمية</th>
                <th className="bg-brand-600 px-4 py-3 text-left font-semibold w-32">سعر الوحدة</th>
                <th className="bg-brand-600 rounded-l-lg px-4 py-3 text-left font-semibold w-32">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it: any, i: number) => (
                <tr key={it.id} className="border-b border-ink-100">
                  <td className="px-4 py-3 text-ink-400 border-b border-ink-100">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-ink-800 border-b border-ink-100">{it.description}</td>
                  <td className="px-4 py-3 text-center text-ink-600 border-b border-ink-100">{it.quantity}</td>
                  <td className="px-4 py-3 text-left text-ink-600 border-b border-ink-100">{fmt(it.unitPrice)}</td>
                  <td className="px-4 py-3 text-left font-semibold text-ink-800 border-b border-ink-100">{fmt(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mt-6">
            <div className="w-full sm:w-80 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">المجموع الفرعي</span>
                <span className="font-semibold text-ink-800">{fmt(inv.subtotal)}</span>
              </div>
              {inv.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">الخصم</span>
                  <span className="font-semibold text-red-600">- {fmt(inv.discount)}</span>
                </div>
              )}
              {inv.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">الضريبة ({inv.taxRate}%)</span>
                  <span className="font-semibold text-ink-800">{fmt(inv.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-brand-gradient text-white rounded-xl px-4 py-3 mt-2">
                <span className="font-bold">الإجمالي المستحق</span>
                <span className="text-xl font-extrabold">{fmt(inv.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="px-8 pb-6">
            <div className="bg-ink-50 rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1.5">ملاحظات وشروط</div>
              <div className="text-sm text-ink-600 whitespace-pre-line">{inv.notes}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-ink-50 px-8 py-5 text-center border-t border-ink-100">
          <div className="font-bold text-ink-800">شكراً لتعاملكم معنا</div>
          <div className="text-xs text-ink-400 mt-1">
            {[org.name, org.phone, org.email].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    </div>
  );
}
