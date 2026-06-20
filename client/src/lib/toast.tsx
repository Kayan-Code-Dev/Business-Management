import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Icon } from "../components/Icon";

type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ notify: (message: string, type?: ToastType) => void }>({ notify: () => {} });

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const styles: Record<ToastType, { bg: string; icon: any }> = {
    success: { bg: "bg-emerald-600", icon: "check" },
    error: { bg: "bg-red-600", icon: "alert" },
    info: { bg: "bg-brand-600", icon: "bell" },
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-5 left-5 z-[100] flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles[t.type].bg} text-white rounded-xl shadow-lift px-4 py-3 text-sm font-medium flex items-center gap-2.5 animate-slide-up min-w-[260px]`}
          >
            <Icon name={styles[t.type].icon} size={18} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
