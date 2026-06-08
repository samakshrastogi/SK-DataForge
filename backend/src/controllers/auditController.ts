import { Request, Response } from "express";
import { AuditLogModel } from "../models/AuditLog";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const logs = await AuditLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      logs: logs.map((log) => ({
        id: String(log._id),
        actorId: log.actorId ? String(log.actorId) : null,
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        message: log.message,
        metadata: log.metadata || {},
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load audit logs.";
    return res.status(400).json({ message });
  }
};
