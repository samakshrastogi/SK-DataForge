import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const importSourceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    provider: {
      type: String,
      required: true,
      enum: [
        "url",
        "local-folder",
        "google-drive",
        "onedrive",
        "sharepoint",
        "s3",
        "azure-blob"
      ],
      index: true
    },
    targetFolderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true
    },
    sourcePath: {
      type: String,
      default: "",
      trim: true
    },
    urlMode: {
      type: String,
      enum: ["single-file", "manifest"],
      default: "single-file"
    },
    scheduleMinutes: {
      type: Number,
      default: 0
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
    lastImportedCount: {
      type: Number,
      default: 0
    },
    lastError: {
      type: String,
      default: ""
    },
    options: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export type ImportSourceDocument = InferSchemaType<typeof importSourceSchema> & {
  targetFolderId: Types.ObjectId | null;
};

export const ImportSourceModel =
  models.ImportSource || model("ImportSource", importSourceSchema);
