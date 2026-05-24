import { InferSchemaType, model, models, Schema } from "mongoose";

const workspaceSettingsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Default Workspace"
    },
    quotaBytes: {
      type: Number,
      required: true,
      default: 30 * 1024 * 1024 * 1024
    },
    warningThresholds: {
      type: [Number],
      default: [75, 90, 100]
    },
    adminLabel: {
      type: String,
      required: true,
      trim: true,
      default: "Workspace Admin"
    },
    lastQuotaNotificationThreshold: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export type WorkspaceSettingsDocument = InferSchemaType<typeof workspaceSettingsSchema>;

export const WorkspaceSettingsModel =
  models.WorkspaceSettings || model("WorkspaceSettings", workspaceSettingsSchema);
