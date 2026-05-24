import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const retentionRuleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      enum: ["archive", "delete"],
      index: true
    },
    maxAgeDays: {
      type: Number,
      required: true,
      min: 1
    },
    targetFolderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true
    },
    tagFilter: {
      type: [String],
      default: []
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    lastRunAt: {
      type: Date,
      default: null
    },
    lastAffectedCount: {
      type: Number,
      default: 0
    },
    lastError: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

export type RetentionRuleDocument = InferSchemaType<typeof retentionRuleSchema> & {
  targetFolderId: Types.ObjectId | null;
};

export const RetentionRuleModel =
  models.RetentionRule || model("RetentionRule", retentionRuleSchema);
