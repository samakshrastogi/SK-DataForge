import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const uploadedFileSchema = new Schema(
  {
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      required: true,
      index: true
    },
    folderName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    extension: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    size: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    path: {
      type: String,
      required: true,
      trim: true
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    tags: {
      type: [String],
      default: [],
      index: true
    },
    lifecycleStatus: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

uploadedFileSchema.index({ folderId: 1, name: 1 }, { unique: true });

export type UploadedFileDocument = InferSchemaType<typeof uploadedFileSchema> & {
  folderId: Types.ObjectId;
};

export const UploadedFileModel =
  models.UploadedFile || model("UploadedFile", uploadedFileSchema);
