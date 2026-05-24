import fs from "fs/promises";
import path from "path";
import { Types } from "mongoose";
import { env } from "../config/env";
import { FolderModel } from "../models/Folder";
import { sanitizeFileName, sanitizeFolderName } from "./uploadPaths";

type FolderRecord = {
  _id: Types.ObjectId | string;
  name: string;
  parentId: Types.ObjectId | string | null;
};

export const ROOT_FOLDER_ID = "root";

const toIdString = (value: Types.ObjectId | string | null | undefined) =>
  value ? String(value) : null;

export const getUploadRootAbsolutePath = () =>
  path.resolve(process.cwd(), env.uploadRoot);

export const ensureUploadRoot = async () => {
  await fs.mkdir(getUploadRootAbsolutePath(), { recursive: true });
};

export const resolveFolderPathFromMap = (
  folder: FolderRecord,
  folderMap: Map<string, FolderRecord>
) => {
  const segments = [folder.name];
  let currentParentId = toIdString(folder.parentId);

  while (currentParentId) {
    const parent = folderMap.get(currentParentId);

    if (!parent) {
      break;
    }

    segments.unshift(parent.name);
    currentParentId = toIdString(parent.parentId);
  }

  return path.join(...segments);
};

export const getAllFolderPathMap = async () => {
  const folders = await FolderModel.find({}, { name: 1, parentId: 1 }).lean<
    Array<{
      _id: Types.ObjectId;
      name: string;
      parentId: Types.ObjectId | null;
    }>
  >();

  const folderMap = new Map(
    folders.map((folder) => [
      String(folder._id),
      {
        _id: folder._id,
        name: folder.name,
        parentId: folder.parentId
      }
    ])
  );

  const pathMap = new Map<string, string>();

  for (const folder of folders) {
    pathMap.set(String(folder._id), resolveFolderPathFromMap(folder, folderMap));
  }

  return { folderMap, pathMap };
};

export const getFolderAbsolutePath = async (folderId: string) => {
  const { pathMap } = await getAllFolderPathMap();
  const relativePath = pathMap.get(folderId);

  if (!relativePath) {
    throw new Error("Folder not found.");
  }

  return path.join(getUploadRootAbsolutePath(), relativePath);
};

export const getTargetParentId = (rawParentId: unknown) => {
  const parentId = String(rawParentId || "").trim();

  if (!parentId || parentId === ROOT_FOLDER_ID) {
    return null;
  }

  return parentId;
};

export const validateFolderName = (folderName: string) =>
  sanitizeFolderName(folderName);

export const validateFileName = (fileName: string) =>
  sanitizeFileName(fileName);
