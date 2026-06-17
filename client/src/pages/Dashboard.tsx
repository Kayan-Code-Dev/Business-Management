import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatCard, StatusBadge, Progress, EmptyState } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate, formatDateTime } from "../lib/format";

const ACTION_ICON: Record<string, any> = {
  create_project: "projects",
  change_status: "activity",
  client_payment: "money",
  specialist_payment: "wallet",
  create_client: "clients",
  create_specialist: "specialists",
  assign_specialist: "user",
  upload_file: "upload",
  add_note: "note",
  login: "user",
};

export default function Dashboard() {
  const { flag, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="تعذّر تحميل البيانات" />;

  const c = data.cards;
  return (
    <div>
      <PageHeader title={`أهلاً، ${user?.name?.split(" ")[0]} 👋`} subtitle="نظرة سريعة على الوضع التشغيلي والمالي" icon="dashboard" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="مشاريع نشطة" value={c.activeProjects} icon="projects" tone="brand" />
        <StatCard title="مشاريع متأخرة" value={c.lateProjects} icon="clock" tone="red" />
        <StatCard title="مكتملة هذا الشهر" value={c.completedThisMonth} icon="check" tone="green" />
        <StatCard title="إجمالي المشاريع" value={c.totalProjects} icon="briefcase" tone="violet" />
        {flag("viewProfits") && (
          <>
            <StatCard title="الإيرادات المحصّلة" value={money(c.revenues)} icon="money" tone="green" />
            <StatCard title="المصروفات" value={money(c.expenses)} icon="wallet" tone="amber" />
            <StatCard title="صافي الربح" value={money(c.netProfit)} icon="trendUp" tone="brand" />
            <StatCard title="متبقّي من العملاء" value={money(c.clientRemaining)} icon="alert" tone="red" />
          </>
        )}
      </div>

      {data.lateProjects?.length > 0 && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-gradient-to-l from-red-50 to-white p-4 animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-red-700 mb-3">
            <Icon name="alert" size={18} /> تنبيه: مشاريع متأخرة ({data.lateProjects.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {data.lateProjects.map((p: any) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="bg-white border border-red-200 rounded-xl px-3 py-2 text-sm hover:shadow-soft hover:-translate-y-0.5 transition flex items-center gap-2"
              >
                <span className="font-bold text-ink-800">{p.projectNumber}</span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-600">{p.client}</span>
                <span className="badge bg-red-50 text-red-600">{formatDate(p.deliveryDate)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink-900 text-lg">أحدث المشاريع</h3>
              <Link to="/projects" className="text-sm text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
                عرض الكل <Icon name="chevronLeft" size={15} />
              </Link>
            </div>
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
                        <Link className="text-brand-600 hover:underline font-bold" to={`/projects/${p.id}`}>
                          {p.projectNumber}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate font-medium text-ink-800">{p.title}</td>
                      <td>{p.client}</td>
                      <td>
                        <StatusBadge status={p.status} isLate={p.isLate} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} />
                          <span className="text-xs text-ink-400 w-8">{p.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.recentProjects.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="لا توجد مشاريع بعد" icon="projects" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <h3 className="font-bold text-ink-900 text-lg mb-4">آخر النشاطات</h3>
          <div className="relative space-y-4">
            {data.activities.map((a: any, i: number) => (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Icon name={ACTION_ICON[a.action] || "activity"} size={15} />
                  </div>
                  {i < data.activities.length - 1 && <div className="w-px flex-1 bg-ink-100 my-1" />}
                </div>
                <div className="pb-1">
                  <div className="text-sm text-ink-700 leading-snug">{a.description}</div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {a.user || "النظام"} · {formatDateTime(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {data.activities.length === 0 && <EmptyState message="لا توجد نشاطات" icon="activity" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
