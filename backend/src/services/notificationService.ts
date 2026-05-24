import { NotificationModel } from "../models/Notification";
import { UploadedFileModel } from "../models/UploadedFile";
import { WorkspaceSettingsModel } from "../models/WorkspaceSettings";
import { getWorkspaceSettings } from "./workspaceService";

type NotificationInput = {
  type: "failed_upload" | "quota_warning" | "duplicate_detected" | "new_version_uploaded" | "processing_completed";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export const createNotification = async ({
  type,
  title,
  message,
  metadata = {}
}: NotificationInput) => {
  await NotificationModel.create({
    type,
    title,
    message,
    metadata
  });
};

export const getStorageUsageBytes = async () => {
  const files = await UploadedFileModel.find(
    { lifecycleStatus: { $ne: "archived" } },
    { size: 1 }
  ).lean<Array<{ size: number }>>();

  return files.reduce((sum, file) => sum + file.size, 0);
};

export const evaluateQuotaNotifications = async () => {
  const [settings, usedBytes] = await Promise.all([
    getWorkspaceSettings(),
    getStorageUsageBytes()
  ]);
  const quotaBytes = Math.max(settings.quotaBytes, 1);
  const usedPercentage = Math.round((usedBytes / quotaBytes) * 100);
  const thresholds = [...(settings.warningThresholds || [])].sort((a, b) => a - b);
  const nextThreshold = thresholds.filter((threshold) => threshold <= usedPercentage).pop() || 0;

  if (nextThreshold > settings.lastQuotaNotificationThreshold) {
    await createNotification({
      type: "quota_warning",
      title: nextThreshold >= 100 ? "Workspace quota exceeded" : "Workspace quota warning",
      message:
        nextThreshold >= 100
          ? `Workspace storage is at ${usedPercentage}% of quota. New uploads may be blocked.`
          : `Workspace storage reached ${usedPercentage}% of quota.`,
      metadata: {
        usedBytes,
        quotaBytes,
        usedPercentage,
        threshold: nextThreshold
      }
    });

    await WorkspaceSettingsModel.updateOne(
      { _id: settings._id },
      { lastQuotaNotificationThreshold: nextThreshold }
    );
  }

  if (usedPercentage < settings.lastQuotaNotificationThreshold) {
    await WorkspaceSettingsModel.updateOne(
      { _id: settings._id },
      { lastQuotaNotificationThreshold: 0 }
    );
  }

  return {
    usedBytes,
    quotaBytes,
    usedPercentage
  };
};
