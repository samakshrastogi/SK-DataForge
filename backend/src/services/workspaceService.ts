import { Types } from "mongoose";
import { WorkspaceSettingsModel } from "../models/WorkspaceSettings";

const DEFAULT_QUOTA_BYTES = 30 * 1024 * 1024 * 1024;

export type WorkspaceSettingsRecord = {
  _id: Types.ObjectId;
  name: string;
  quotaBytes: number;
  warningThresholds: number[];
  adminLabel: string;
  lastQuotaNotificationThreshold: number;
};

export const getWorkspaceSettings = async (): Promise<WorkspaceSettingsRecord> => {
  let settings = await WorkspaceSettingsModel.findOne({}).lean<WorkspaceSettingsRecord | null>();

  if (!settings) {
    const created = await WorkspaceSettingsModel.create({
      name: "Default Workspace",
      quotaBytes: DEFAULT_QUOTA_BYTES,
      warningThresholds: [75, 90, 100],
      adminLabel: "Workspace Admin",
      lastQuotaNotificationThreshold: 0
    });
    settings = {
      _id: created._id,
      name: created.name,
      quotaBytes: created.quotaBytes,
      warningThresholds: created.warningThresholds,
      adminLabel: created.adminLabel,
      lastQuotaNotificationThreshold: created.lastQuotaNotificationThreshold
    };
  }

  return settings;
};
