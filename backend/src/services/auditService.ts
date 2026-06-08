import { Request } from "express";
import { AuditLogModel } from "../models/AuditLog";

export const createAuditLog = async (
  req: Request,
  input: {
    action: string;
    targetType: string;
    targetId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  await AuditLogModel.create({
    actorId: req.authUser?.id || null,
    actorEmail: req.authUser?.email || "",
    actorRole: req.authUser?.role || "",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId || "",
    message: input.message || "",
    metadata: input.metadata || {},
    ipAddress: req.ip || ""
  });
};
