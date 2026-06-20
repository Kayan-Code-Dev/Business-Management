import { prisma } from "../prisma";

export async function logActivity(params: {
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  projectId?: number;
  description: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        projectId: params.projectId,
        description: params.description,
      },
    });
  } catch (e) {
    // لا نوقف العملية الأساسية بسبب فشل التسجيل
    console.error("activity log error", e);
  }
}
