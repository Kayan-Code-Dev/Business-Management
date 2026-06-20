import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatusBadge, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, formatDate } from "../lib/format";

export default function SpecialistDetail() {
  const { id } = useParams();
  const { flag } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/specialists/${id}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="المختص غير موجود" />;

  return (
    <div>
      <PageHeader
        title={data.name}
        subtitle={`${data.specialization || ""} ${data.experienceLevel ? "· " + data.experienceLevel : ""}`}
        icon="specialists"
        actions={<Link to="/specialists" className="btn-secondary"><Icon name="chevronRight" size={16} /> رجوع</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="!p-4">
          <div className="text-sm text-slate-500">عدد المهام</div>
          <div className="text-xl font-bold">{data.summary.tasksCount}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">المكتملة</div>
          <div className="text-xl font-bold text-green-600">{data.summary.completedTasks}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-sm text-slate-500">نسبة الالتزام</div>
          <div className="text-xl font-bold text-brand-700">{data.summary.commitmentRate}%</div>
        </Card>
        {flag("viewSpecialistCosts") && (
          <Card className="!p-4">
            <div className="text-sm text-slate-500">المستحق له</div>
            <div className="text-xl font-bold text-red-600">{money(data.summary.totalDue)}</div>
          </Card>
        )}
      </div>

      {data.skills && (
        <Card className="mb-4">
          <div className="text-sm text-slate-500 mb-2">المهارات</div>
          <div className="flex flex-wrap gap-2">
            {String(data.skills).split(/[،,]/).map((s: string, i: number) => (
              <Badge key={i} color="bg-brand-50 text-brand-700">{s.trim()}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <h3 className="font-bold text-slate-800 mb-3">المهام والمشاريع</h3>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>المشروع</th>
                <th>الدور</th>
                <th>حالة المشروع</th>
                <th>التسليم الداخلي</th>
                {flag("viewSpecialistCosts") && <th>التكلفة</th>}
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <Link className="text-brand-600 hover:underline" to={`/projects/${t.projectId}`}>
                      {t.projectNumber} · {t.projectTitle}
                    </Link>
                  </td>
                  <td>{t.role || "—"}</td>
                  <td><StatusBadge status={t.projectStatus} isLate={t.isLate} /></td>
                  <td>{formatDate(t.internalDeliveryDate)}</td>
                  {flag("viewSpecialistCosts") && <td>{money(t.cost)}</td>}
                </tr>
              ))}
              {data.tasks.length === 0 && (
                <tr><td colSpan={5}><EmptyState message="لا توجد مهام" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {flag("viewSpecialistCosts") && (
        <Card>
          <h3 className="font-bold text-slate-800 mb-3">الدفعات المستلمة</h3>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>ملاحظة</th></tr>
              </thead>
              <tbody>
                {data.payments.map((p: any) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td className="text-amber-600 font-medium">{money(p.amount)}</td>
                    <td>{p.method || "—"}</td>
                    <td>{p.note || "—"}</td>
                  </tr>
                ))}
                {data.payments.length === 0 && (
                  <tr><td colSpan={4}><EmptyState message="لا توجد دفعات" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
