export function resolveRange(query: Record<string, any>): { from: Date; to: Date; label: string } {
  const period = (query.period as string) || "month";
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let label = "";

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      label = "اليوم";
      break;
    case "week": {
      const day = now.getDay();
      const diff = (day + 6) % 7; // الأسبوع يبدأ السبت تقريباً؛ نستخدم 7 أيام للخلف
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      label = "هذا الأسبوع";
      break;
    }
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      label = "هذا العام";
      break;
    case "custom": {
      const f = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
      const t = query.to ? new Date(query.to) : now;
      from = isNaN(f.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : f;
      to = isNaN(t.getTime()) ? to : new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
      label = "فترة مخصصة";
      break;
    }
    case "all":
      from = new Date(2000, 0, 1);
      label = "كل الفترات";
      break;
    case "month":
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "هذا الشهر";
      break;
  }
  return { from, to, label };
}
