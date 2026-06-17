import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PageHeader, Card, Spinner, StatCard, EmptyState } from "../components/ui";
import { Icon } from "../components/Icon";
import { money } from "../lib/format";

const PERIODS = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "year", label: "هذا العام" },
  { key: "all", label: "الكل" },
  { key: "custom", label: "مخصص" },
];

export default function Reports() {
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params: any = { period };
    if (period === "custom") {
      params.from = from;
      params.to = to;
    }
    api
      .get("/reports", { params })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (period !== "custom") load();
  }, [period]);

  const exportExcel = async () => {
    const params: any = { period };
    if (period === "custom") { params.from = from; params.to = to; }
    const res = await api.get("/reports/export/excel", { params, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-${period}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle={data ? `الفترة: ${data.range.label}` : "تقارير تشغيلية ومالية"}
        icon="reports"
        actions={
          <>
            <button className="btn-secondary" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة / PDF</button>
            <button className="btn-primary" onClick={exportExcel}><Icon name="excel" size={16} /> تصدير Excel</button>
          </>
        }
      />

      <Card className="mb-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-sm rounded-lg ${period === p.key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="label">من</label>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">إلى</label>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={load}>عرض</button>
            </div>
          )}
        </div>
      </Card>

      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          {/* Projects */}
          <div>
            <h3 className="font-bold text-slate-700 mb-2">تقارير المشاريع</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard title="إجمالي" value={data.projects.total} tone="brand" />
              <StatCard title="نشطة" value={data.projects.active} tone="brand" />
              <StatCard title="مكتملة" value={data.projects.completed} tone="green" />
              <StatCard title="متأخرة" value={data.projects.late} tone="red" />
              <StatCard title="قيد المراجعة" value={data.projects.underReview} tone="amber" />
            </div>
          </div>

          {/* Financial */}
          <div>
            <h3 className="font-bold text-slate-700 mb-2">التقارير المالية</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="الإيرادات (الفترة)" value={money(data.financial.revenues)} tone="green" />
              <StatCard title="المحصّل (إجمالي)" value={money(data.financial.totalCollected)} tone="green" />
              <StatCard title="غير المحصّل" value={money(data.financial.totalUncollected)} tone="red" />
              <StatCard title="مدفوع للمختصين" value={money(data.financial.specialistPaid)} tone="amber" />
              <StatCard title="المصروفات" value={money(data.financial.expenses)} tone="amber" />
              <StatCard title="صافي الربح" value={money(data.financial.netProfit)} tone="brand" />
              <StatCard title="متوسط الربح/مشروع" value={money(data.financial.avgProfitPerProject)} tone="slate" />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top services */}
            <Card>
              <h3 className="font-bold text-slate-800 mb-3">أكثر الخدمات ربحاً</h3>
              <table className="table-base">
                <thead><tr><th>الخدمة</th><th>الربح المتوقع</th></tr></thead>
                <tbody>
                  {data.financial.topServices.map((s: any, i: number) => (
                    <tr key={i}><td>{s.name}</td><td className="text-brand-700">{money(s.profit)}</td></tr>
                  ))}
                  {data.financial.topServices.length === 0 && <tr><td colSpan={2}><EmptyState message="لا بيانات" /></td></tr>}
                </tbody>
              </table>
            </Card>

            {/* By status */}
            <Card>
              <h3 className="font-bold text-slate-800 mb-3">المشاريع حسب الحالة</h3>
              <table className="table-base">
                <thead><tr><th>الحالة</th><th>العدد</th></tr></thead>
                <tbody>
                  {data.projects.byStatus.map((s: any) => (
                    <tr key={s.status}><td>{s.label}</td><td>{s.count}</td></tr>
                  ))}
                  {data.projects.byStatus.length === 0 && <tr><td colSpan={2}><EmptyState message="لا بيانات" /></td></tr>}
                </tbody>
              </table>
            </Card>

            {/* Specialists */}
            <Card>
              <h3 className="font-bold text-slate-800 mb-3">أداء المختصين</h3>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>المختص</th><th>المهام</th><th>المكتملة</th><th>المتأخرة</th><th>الالتزام</th></tr></thead>
                  <tbody>
                    {data.specialists.map((s: any) => (
                      <tr key={s.id}><td>{s.name}</td><td>{s.tasks}</td><td>{s.completed}</td><td className="text-red-600">{s.lateTasks}</td><td>{s.commitmentRate}%</td></tr>
                    ))}
                    {data.specialists.length === 0 && <tr><td colSpan={5}><EmptyState message="لا بيانات" /></td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Clients */}
            <Card>
              <h3 className="font-bold text-slate-800 mb-3">العملاء المتعثرون</h3>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>العميل</th><th>المشاريع</th><th>المتبقي</th></tr></thead>
                  <tbody>
                    {data.clients.defaulters.map((c: any) => (
                      <tr key={c.id}><td>{c.name}</td><td>{c.projectsCount}</td><td className="text-red-600">{money(c.remaining)}</td></tr>
                    ))}
                    {data.clients.defaulters.length === 0 && <tr><td colSpan={3}><EmptyState message="لا يوجد متعثرون" /></td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Operations */}
          <div>
            <h3 className="font-bold text-slate-700 mb-2">تقارير العمليات</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="متوسط مدة الإنجاز (يوم)" value={data.operations.avgDeliveryDays} tone="brand" />
              <StatCard title="مشاريع متأخرة" value={data.operations.lateProjects} tone="red" />
              <StatCard title="مشاريع بتعديلات" value={data.operations.revisionsCount} tone="amber" />
              <StatCard title="مشاريع مكتملة" value={data.operations.completedProjects} tone="green" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
