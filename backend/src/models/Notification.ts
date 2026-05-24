import { InferSchemaType, model, models, Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "failed_upload",
        "quota_warning",
        "duplicate_detected",
        "new_version_uploaded",
        "processing_completed"
      ],
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const NotificationModel =
  models.Notification || model("Notification", notificationSchema);
