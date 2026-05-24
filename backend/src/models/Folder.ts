import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const folderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

folderSchema.index({ parentId: 1, name: 1 }, { unique: true });

export type FolderDocument = InferSchemaType<typeof folderSchema> & {
  parentId: Types.ObjectId | null;
};

export const FolderModel =
  models.Folder || model("Folder", folderSchema);
