import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { money, formatDate } from "../lib/format";

export default function ClientDetail() {
  const { id } = useParams();
  const { flag } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/clients/${id}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState message="العميل غير موجود" />;

  return (
    <div>
      <PageHeader
        title={data.name}
        subtitle={`${data.phone || ""} ${data.country ? "· " + data.country : ""}`}
        actions={<Link to="/clients" className="btn-secondary">رجوع</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="!p-4">
          <div className="text-sm text-slate-500">عدد المشاريع</div>
          <div className="text-xl font-bold">{data.summary.projectsCount}</div>
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
        <h3 className="font-bold text-slate-800 mb-3">مشاريع العميل</h3>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>رقم</th>
                <th>المشروع</th>
                <th>الحالة</th>
                <th>التسليم</th>
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
                    <Link className="text-brand-600 hover:underline" to={`/projects/${p.id}`}>{p.projectNumber}</Link>
                  </td>
                  <td className="max-w-[180px] truncate">{p.title}</td>
                  <td><StatusBadge status={p.status} isLate={p.isLate} /></td>
                  <td>{formatDate(p.deliveryDate)}</td>
                  <td>{money(p.value)}</td>
                  <td className="text-green-600">{money(p.clientPaid)}</td>
                  <td className={p.clientRemaining > 0 ? "text-red-600" : ""}>{money(p.clientRemaining)}</td>
                  {flag("viewProfits") && <td className="text-brand-700">{money(p.netProfit)}</td>}
                </tr>
              ))}
              {data.projects.length === 0 && (
                <tr><td colSpan={8}><EmptyState message="لا توجد مشاريع" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-800 mb-3">سجل الدفعات</h3>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الطريقة</th>
                <th>المشروع</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td className="text-green-600 font-medium">{money(p.amount)}</td>
                  <td>{p.method || "—"}</td>
                  <td>{p.project?.projectNumber || "—"}</td>
                  <td>{p.note || "—"}</td>
                </tr>
              ))}
              {data.payments.length === 0 && (
                <tr><td colSpan={5}><EmptyState message="لا توجد دفعات" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
