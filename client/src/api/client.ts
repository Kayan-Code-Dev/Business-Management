import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const onPublic = location.pathname.startsWith("/p/");
      const hadToken = !!localStorage.getItem("token");
      localStorage.removeItem("token");
      // أعد التوجيه فقط إذا انتهت جلسة فعلية ولسنا على صفحة عامة
      if (hadToken && !onPublic && !location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function apiError(err: any): string {
  return err?.response?.data?.message || "حدث خطأ، حاول مرة أخرى";
}
