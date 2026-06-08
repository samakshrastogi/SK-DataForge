import { InferSchemaType, model, models, Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    actorEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true
    },
    actorRole: {
      type: String,
      default: "",
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    targetId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },
    message: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = models.AuditLog || model("AuditLog", auditLogSchema);
