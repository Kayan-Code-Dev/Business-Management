import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatCard, StatusBadge, Progress, EmptyState } from "../components/ui";
import { money, formatDate, formatDateTime } from "../lib/format";

export default function Dashboard() {
  const { flag } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard")
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="تعذّر تحميل البيانات" />;

  const c = data.cards;
  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة سريعة على الوضع التشغيلي والمالي" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="مشاريع نشطة" value={c.activeProjects} icon="📁" tone="brand" />
        <StatCard title="مشاريع متأخرة" value={c.lateProjects} icon="⏰" tone="red" />
        <StatCard title="مكتملة هذا الشهر" value={c.completedThisMonth} icon="✅" tone="green" />
        <StatCard title="إجمالي المشاريع" value={c.totalProjects} icon="📊" tone="slate" />
        {flag("viewProfits") && (
          <>
            <StatCard title="الإيرادات المحصّلة" value={money(c.revenues)} icon="💵" tone="green" />
            <StatCard title="المصروفات" value={money(c.expenses)} icon="💸" tone="amber" />
            <StatCard title="صافي الربح" value={money(c.netProfit)} icon="📈" tone="brand" />
            <StatCard title="متبقّي من العملاء" value={money(c.clientRemaining)} icon="🧾" tone="red" />
          </>
        )}
      </div>

      {data.lateProjects?.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="font-semibold text-red-700 mb-2">⚠️ مشاريع متأخرة ({data.lateProjects.length})</div>
          <div className="flex flex-wrap gap-2">
            {data.lateProjects.map((p: any) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="bg-white border border-red-200 rounded-lg px-3 py-1.5 text-sm hover:bg-red-100"
              >
                <span className="font-medium">{p.projectNumber}</span> · {p.client} · تسليم {formatDate(p.deliveryDate)}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <h3 className="font-bold text-slate-800 mb-3">أحدث المشاريع</h3>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>رقم</th>
                    <th>المشروع</th>
                    <th>العميل</th>
                    <th>الحالة</th>
                    <th>التقدّم</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentProjects.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="text-brand-600 hover:underline" to={`/projects/${p.id}`}>
                          {p.projectNumber}
                        </Link>
                      </td>
                      <td className="max-w-[180px] truncate">{p.title}</td>
                      <td>{p.client}</td>
                      <td>
                        <StatusBadge status={p.status} isLate={p.isLate} />
                      </td>
                      <td>
                        <Progress value={p.progress} />
                      </td>
                    </tr>
                  ))}
                  {data.recentProjects.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="لا توجد مشاريع" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <h3 className="font-bold text-slate-800 mb-3">آخر النشاطات</h3>
          <div className="space-y-3">
            {data.activities.map((a: any) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-slate-700">{a.description}</div>
                  <div className="text-xs text-slate-400">
                    {a.user || "النظام"} · {formatDateTime(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {data.activities.length === 0 && <EmptyState message="لا توجد نشاطات" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
