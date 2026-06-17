import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { verifyToken } from "../utils/auth";
import { parsePermissions, PermissionSet, ModuleName, ActionName } from "../permissions";

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  roleId: number;
  roleName: string;
  roleNameAr: string;
  permissions: PermissionSet;
  specialistId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "غير مصرح: مطلوب تسجيل الدخول" });
    }
    const token = header.substring(7);
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "الحساب غير موجود أو معطّل" });
    }
    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      roleId: user.roleId,
      roleName: user.role.name,
      roleNameAr: user.role.nameAr,
      permissions: parsePermissions(user.role.permissions),
      specialistId: user.specialistId,
    };
    next();
  } catch (e) {
    return res.status(401).json({ message: "جلسة غير صالحة، يرجى إعادة تسجيل الدخول" });
  }
}

export function authorize(module: ModuleName, action: ActionName = "view") {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    const perm = user.permissions.modules[module];
    if (!perm || !perm[action]) {
      return res.status(403).json({ message: "ليس لديك صلاحية لهذا الإجراء" });
    }
    next();
  };
}
