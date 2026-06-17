import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../api/client";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-brand-700 to-brand-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 text-white">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-2xl font-bold">نظام إدارة المشاريع</h1>
          <p className="text-brand-200 text-sm mt-1">إدارة المشاريع الأكاديمية والخدمية</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4 text-slate-800">تسجيل الدخول</h2>
          {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">اسم المستخدم</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400 mb-2">دخول سريع (تجريبي - كلمة المرور 123456):</p>
            <div className="flex flex-wrap gap-2">
              {[
                ["admin", "مدير النظام"],
                ["manager", "مدير المشاريع"],
                ["service", "خدمة العملاء"],
                ["accountant", "المحاسب"],
                ["specialist", "المختص"],
              ].map(([u, label]) => (
                <button key={u} onClick={() => quick(u)} className="btn-secondary text-xs px-2 py-1">
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
