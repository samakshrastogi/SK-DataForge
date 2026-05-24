import { Request, Response } from "express";
import { WorkspaceSettingsModel } from "../models/WorkspaceSettings";
import { evaluateQuotaNotifications, getStorageUsageBytes } from "../services/notificationService";
import { getWorkspaceSettings } from "../services/workspaceService";

export const getWorkspaceSettingsSummary = async (_req: Request, res: Response) => {
  try {
    const [settings, usedBytes] = await Promise.all([
      getWorkspaceSettings(),
      getStorageUsageBytes()
    ]);
    const usedPercentage = Math.min(Math.round((usedBytes / Math.max(settings.quotaBytes, 1)) * 100), 999);

    return res.status(200).json({
      id: String(settings._id),
      name: settings.name,
      adminLabel: settings.adminLabel,
      quotaBytes: settings.quotaBytes,
      warningThresholds: settings.warningThresholds,
      usedBytes,
      usedPercentage,
      remainingBytes: Math.max(settings.quotaBytes - usedBytes, 0)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workspace settings.";
    return res.status(400).json({ message });
  }
};

export const updateWorkspaceSettings = async (req: Request, res: Response) => {
  try {
    const current = await getWorkspaceSettings();
    const quotaBytes = Number(req.body.quotaBytes || current.quotaBytes);
    const warningThresholds = Array.isArray(req.body.warningThresholds)
      ? req.body.warningThresholds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value > 0 && value <= 100)
          .sort((a: number, b: number) => a - b)
      : current.warningThresholds;

    await WorkspaceSettingsModel.updateOne(
      { _id: current._id },
      {
        name: String(req.body.name || current.name).trim(),
        adminLabel: String(req.body.adminLabel || current.adminLabel).trim(),
        quotaBytes: Math.max(quotaBytes, 1),
        warningThresholds
      }
    );

    await evaluateQuotaNotifications();
    return res.status(200).json({ message: "Workspace settings updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workspace settings.";
    return res.status(400).json({ message });
  }
};
