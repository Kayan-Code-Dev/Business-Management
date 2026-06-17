import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PageHeader, Card, Spinner, EmptyState } from "../components/ui";
import { formatDateTime } from "../lib/format";

export default function Activity() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    api
      .get("/activity", { params: { search, page, pageSize: 30 } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      <PageHeader title="سجل النشاطات" subtitle="جميع العمليات المهمة في النظام" icon="activity" />
      <Card className="mb-4">
        <div className="flex gap-2 max-w-md">
          <input className="input" placeholder="بحث في الوصف" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())} />
          <button className="btn-secondary" onClick={() => { setPage(1); load(); }}>بحث</button>
        </div>
      </Card>
      <Card>
        {loading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="لا توجد نشاطات" />
        ) : (
          <>
            <table className="table-base">
              <thead>
                <tr><th>الوصف</th><th>المستخدم</th><th>النوع</th><th>التاريخ والوقت</th></tr>
              </thead>
              <tbody>
                {data.items.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.description}</td>
                    <td>{a.user || "النظام"}</td>
                    <td className="text-xs text-slate-500">{a.action}</td>
                    <td className="text-sm">{formatDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-500">الإجمالي: {data.total}</span>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
                <span className="px-2 py-1">{page} / {totalPages || 1}</span>
                <button className="btn-secondary text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
