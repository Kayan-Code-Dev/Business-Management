import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

export interface ModulePerm {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}
export interface Permissions {
  modules: Record<string, ModulePerm>;
  flags: {
    viewProfits: boolean;
    viewSpecialistCosts: boolean;
    onlyAssignedProjects: boolean;
    manageBackups: boolean;
  };
}
export interface AuthUser {
  id: number;
  name: string;
  username: string;
  email?: string;
  roleName: string;
  roleNameAr: string;
  permissions: Permissions;
  specialistId?: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (module: string, action?: keyof ModulePerm) => boolean;
  flag: (name: keyof Permissions["flags"]) => boolean;
}

const AuthContext = createContext<AuthContextType>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    location.href = "/login";
  };

  const can = (module: string, action: keyof ModulePerm = "view") => {
    if (!user) return false;
    const m = user.permissions.modules[module];
    return !!(m && m[action]);
  };

  const flag = (name: keyof Permissions["flags"]) => !!user?.permissions.flags[name];

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, flag }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
