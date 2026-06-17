import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../api/client";
import { Icon } from "../components/Icon";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const quick = (u: string) => {
    setUsername(u);
    setPassword("123456");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-950">
      {/* Brand side */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-sidebar-gradient overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3 text-white">
          <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Icon name="briefcase" size={26} className="text-brand-200" />
          </div>
          <span className="font-bold text-xl">نظام إدارة المشاريع</span>
        </div>
        <div className="relative text-white">
          <h2 className="text-4xl font-extrabold leading-snug mb-4">
            أدِر مشاريعك وعملاءك
            <br />
            <span className="text-brand-300">باحترافية كاملة</span>
          </h2>
          <p className="text-indigo-200/80 text-lg max-w-md leading-relaxed">
            منصة متكاملة لإدارة المشاريع الأكاديمية والخدمية — من إنشاء المشروع حتى الإغلاق المالي، مع تقارير ولوحة تحكم لحظية.
          </p>
          <div className="flex gap-6 mt-8">
            {[
              ["إدارة المشاريع", "projects"],
              ["متابعة مالية", "wallet"],
              ["تقارير فورية", "reports"],
            ].map(([t, ic]) => (
              <div key={t} className="flex items-center gap-2 text-indigo-200/90 text-sm">
                <Icon name={ic as any} size={18} className="text-brand-300" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-indigo-300/50 text-xs">© {new Date().getFullYear()} — جميع الحقوق محفوظة</div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 bg-ink-100">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8 text-ink-900">
            <div className="h-12 w-12 rounded-2xl bg-brand-gradient flex items-center justify-center text-white">
              <Icon name="briefcase" size={26} />
            </div>
            <span className="font-bold text-xl">نظام إدارة المشاريع</span>
          </div>
          <div className="card p-8 shadow-lift">
            <h1 className="text-2xl font-extrabold text-ink-900 mb-1">مرحباً بعودتك 👋</h1>
            <p className="text-ink-500 text-sm mb-6">سجّل الدخول للمتابعة إلى لوحة التحكم</p>
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 flex items-center gap-2">
                <Icon name="alert" size={16} /> {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">اسم المستخدم</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="admin" />
              </div>
              <div>
                <label className="label">كلمة المرور</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
              </div>
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </button>
            </form>
            <div className="mt-6 border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-400 mb-2">دخول سريع للتجربة (كلمة المرور 123456):</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ["admin", "مدير النظام"],
                  ["manager", "مدير المشاريع"],
                  ["service", "خدمة العملاء"],
                  ["accountant", "المحاسب"],
                  ["specialist", "المختص"],
                ].map(([u, label]) => (
                  <button key={u} onClick={() => quick(u)} className="chip hover:border-brand-300 hover:text-brand-700 transition">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
