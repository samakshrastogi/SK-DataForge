import { NextFunction, Request, Response } from "express";
import { createAuditLog } from "../services/auditService";

const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE"]);

const getTargetType = (pathValue: string) =>
  pathValue.split("/").filter(Boolean)[0] || "workspace";

export const auditMutations = (req: Request, res: Response, next: NextFunction) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      return;
    }

    void createAuditLog(req, {
      action: `${req.method} ${req.path}`,
      targetType: getTargetType(req.path),
      targetId: String(req.params.fileId || req.params.folderId || req.params.sourceId || req.params.ruleId || ""),
      message: `${req.method} ${req.originalUrl}`,
      metadata: {
        params: req.params,
        query: req.query
      }
    });
  });

  return next();
};
