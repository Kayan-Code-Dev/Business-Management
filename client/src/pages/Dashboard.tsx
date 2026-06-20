import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatCard, StatusBadge, Progress, EmptyState, Badge } from "../components/ui";
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

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  assigned: { label: "بانتظار المختص", color: "bg-violet-50 text-violet-700" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-50 text-blue-700" },
  completed: { label: "مكتمل", color: "bg-emerald-50 text-emerald-700" },
};

export default function Dashboard() {
  const { flag, user, can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="تعذّر تحميل البيانات" />;

  const c = data.cards;
  const quickActions = [
    can("projects", "create") && { to: "/projects", label: "إضافة مشروع جديد", icon: "projects" as const },
    can("clients", "create") && { to: "/clients", label: "إضافة عميل جديد", icon: "clients" as const },
    can("projects", "edit") && { to: "/projects", label: "إضافة مهمة جديدة", icon: "activity" as const },
    can("financial", "create") && { to: "/financial", label: "تسجيل دفعة مالية", icon: "wallet" as const },
  ].filter(Boolean) as { to: string; label: string; icon: "projects" | "clients" | "activity" | "wallet" }[];

  return (
    <div>
      <PageHeader title={`أهلاً، ${user?.name?.split(" ")[0]} 👋`} subtitle="نظرة سريعة على الوضع التشغيلي والمالي" icon="dashboard" />

      {quickActions.length > 0 && (
        <Card className="mb-5 !p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink-700 me-1">الإجراءات السريعة:</span>
            {quickActions.map((a) => (
              <Link key={a.label} to={a.to} className="btn-secondary text-sm">
                <Icon name={a.icon} size={16} /> {a.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

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
            <StatCard
              title="المستحقات غير المحصلة"
              value={money(c.clientRemaining)}
              icon="alert"
              tone="red"
              hint={<span className="text-red-600">على {c.uncollectedProjectsCount || 0} مشروع</span>}
            />
          </>
        )}
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink-900 text-lg">المهام المستحقة اليوم</h3>
          <Badge color="bg-brand-50 text-brand-700">{data.todayTasks?.length || 0} مهام</Badge>
        </div>
        {data.todayTasks?.length ? (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>اسم المهمة</th>
                  <th>اسم المختص</th>
                  <th>اسم المشروع</th>
                  <th>موعد التسليم</th>
                  <th>حالة المهمة</th>
                </tr>
              </thead>
              <tbody>
                {data.todayTasks.map((t: any) => {
                  const meta = TASK_STATUS_META[t.status] || { label: t.statusLabel || t.status, color: "bg-ink-100 text-ink-700" };
                  return (
                    <tr key={t.id}>
                      <td className="font-medium text-ink-800">{t.taskName}</td>
                      <td>{t.specialist}</td>
                      <td>
                        <Link className="text-brand-600 hover:underline font-semibold" to={`/projects/${t.projectId}`}>
                          {t.projectNumber} · {t.projectTitle}
                        </Link>
                      </td>
                      <td>{formatDate(t.deliveryDate)}</td>
                      <td>
                        <Badge color={meta.color}>{meta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="لا توجد مهام مستحقة اليوم" icon="check" />
        )}
      </Card>

      {data.lateProjects?.length > 0 && (
        <Card className="mb-5 !p-4 border border-red-200 bg-gradient-to-l from-red-50 to-white animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-red-700 mb-3">
            <Icon name="alert" size={18} /> تنبيه: مشاريع متأخرة ({data.lateProjects.length})
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>رقم المشروع</th>
                  <th>اسم المشروع</th>
                  <th>اسم المختص المسؤول</th>
                  <th>عدد أيام التأخير</th>
                  <th>موعد التسليم الأصلي</th>
                </tr>
              </thead>
              <tbody>
                {data.lateProjects.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="text-brand-600 hover:underline font-bold" to={`/projects/${p.id}`}>
                        {p.projectNumber}
                      </Link>
                    </td>
                    <td className="font-medium text-ink-800">{p.title}</td>
                    <td>{p.responsibleSpecialist}</td>
                    <td>
                      <Badge color="bg-red-50 text-red-700">{p.daysLate} يوم</Badge>
                    </td>
                    <td>{formatDate(p.deliveryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
