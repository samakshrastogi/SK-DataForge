import fs from "fs/promises";
import archiver from "archiver";
import path from "path";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { getFileCategory } from "../constants/uploads";
import { FolderModel } from "../models/Folder";
import { UploadedFileModel } from "../models/UploadedFile";
import {
  buildSnippet,
  computeFileHashFromPath,
  extractSearchableContent,
  resolveAbsoluteFilePath
} from "../utils/fileIntelligence";
import {
  ensureUploadRoot,
  getAllFolderPathMap,
  getTargetParentId,
  getUploadRootAbsolutePath,
  ROOT_FOLDER_ID,
  validateFileName,
  validateFolderName
} from "../utils/fileManager";

type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
};

const toIdString = (value: Types.ObjectId | string | null | undefined) =>
  value ? String(value) : null;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

const createFolderTree = async () => {
  const folders = await FolderModel.find({}, { name: 1, parentId: 1 })
    .sort({ name: 1 })
    .lean<Array<{ _id: Types.ObjectId; name: string; parentId: Types.ObjectId | null }>>();

  const nodes = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    nodes.set(String(folder._id), {
      id: String(folder._id),
      name: folder.name,
      parentId: toIdString(folder.parentId),
      children: []
    });
  }

  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
};

const ROOT_FOLDER_NAME = "Home";

const normalizeExtension = (name: string) => path.extname(name).toLowerCase();

const getFolderPathLabel = (relativePath: string | undefined) =>
  relativePath ? `${ROOT_FOLDER_NAME} / ${relativePath.split(path.sep).join(" / ")}` : ROOT_FOLDER_NAME;

const getFilePathLabel = (relativePath: string) =>
  `${ROOT_FOLDER_NAME} / ${relativePath.split(path.sep).join(" / ")}`;

const ACTIVE_FILE_FILTER = { lifecycleStatus: { $ne: "archived" } };

const collectDescendantFolderIds = async (folderIds: string[]) => {
  const allFolders = await FolderModel.find({}, { _id: 1, parentId: 1 }).lean<
    Array<{ _id: Types.ObjectId; parentId: Types.ObjectId | null }>
  >();
  const descendantIds = new Set(folderIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const folder of allFolders) {
      const parentId = toIdString(folder.parentId);
      const currentId = String(folder._id);

      if (parentId && descendantIds.has(parentId) && !descendantIds.has(currentId)) {
        descendantIds.add(currentId);
        changed = true;
      }
    }
  }

  return Array.from(descendantIds);
};

const appendZipFile = async (
  archive: archiver.Archiver,
  filePath: string,
  nameInArchive: string
) => {
  try {
    await fs.access(filePath);
    archive.file(filePath, { name: nameInArchive });
  } catch {
    return;
  }
};

const getBulkSelection = (body: unknown) => {
  const payload = (body || {}) as {
    folderIds?: unknown[];
    fileIds?: unknown[];
  };

  const folderIds = Array.isArray(payload.folderIds)
    ? payload.folderIds.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const fileIds = Array.isArray(payload.fileIds)
    ? payload.fileIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (!folderIds.length && !fileIds.length) {
    throw new Error("Choose at least one folder or file.");
  }

  return { folderIds, fileIds };
};

const getDuplicateGroups = async () => {
  const duplicateGroups = await UploadedFileModel.aggregate<{
    _id: string;
    size: number;
    count: number;
    files: Array<{
      _id: Types.ObjectId;
      name: string;
      folderName: string;
      path: string;
      extension: string;
      updatedAt: Date;
    }>;
  }>([
    {
      $match: {
        lifecycleStatus: { $ne: "archived" },
        contentHash: { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: "$contentHash",
        size: { $first: "$size" },
        count: { $sum: 1 },
        files: {
          $push: {
            _id: "$_id",
            name: "$name",
            folderName: "$folderName",
            path: "$path",
            extension: "$extension",
            updatedAt: "$updatedAt"
          }
        }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: {
        count: -1,
        size: -1
      }
    }
  ]);

  return duplicateGroups.map((group) => ({
    hash: group._id,
    count: group.count,
    size: group.size,
    wastedBytes: group.size * (group.count - 1),
    files: group.files
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((file) => ({
        id: String(file._id),
        name: file.name,
        folderName: file.folderName,
        path: getFilePathLabel(file.path),
        extension: file.extension,
        updatedAt: file.updatedAt
      }))
  }));
};

const getFolderBreadcrumbs = async (folderId: string | null) => {
  if (!folderId) {
    return [{ id: ROOT_FOLDER_ID, name: ROOT_FOLDER_NAME }];
  }

  const folders = await FolderModel.find({}, { name: 1, parentId: 1 }).lean<
    Array<{ _id: Types.ObjectId; name: string; parentId: Types.ObjectId | null }>
  >();
  const folderMap = new Map(folders.map((folder) => [String(folder._id), folder]));
  const trail: Array<{ id: string; name: string }> = [{ id: ROOT_FOLDER_ID, name: ROOT_FOLDER_NAME }];

  let currentId: string | null = folderId;
  const stack: Array<{ id: string; name: string }> = [];

  while (currentId) {
    const folder = folderMap.get(currentId);

    if (!folder) {
      break;
    }

    stack.unshift({ id: String(folder._id), name: folder.name });
    currentId = toIdString(folder.parentId);
  }

  return trail.concat(stack);
};

const getFolderContentsPayload = async (folderId: string | null) => {
  const folderFilter = folderId ? new Types.ObjectId(folderId) : null;
  const folder = folderId
    ? await FolderModel.findById(folderId, { name: 1, parentId: 1 }).lean<{
        _id: Types.ObjectId;
        name: string;
        parentId: Types.ObjectId | null;
      } | null>()
    : null;

  if (folderId && !folder) {
    throw new Error("Folder not found.");
  }

  const childFolders = await FolderModel.find(
    { parentId: folderFilter },
    { name: 1, parentId: 1, updatedAt: 1 }
  )
    .sort({ name: 1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        parentId: Types.ObjectId | null;
        updatedAt: Date;
      }>
    >();

  const files = await UploadedFileModel.find(
    folderId
      ? { folderId: new Types.ObjectId(folderId), ...ACTIVE_FILE_FILTER }
      : { folderId: null as never, ...ACTIVE_FILE_FILTER },
    { name: 1, originalName: 1, size: 1, type: 1, folderName: 1, updatedAt: 1, tags: 1 }
  )
    .sort({ name: 1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        originalName: string;
        size: number;
        type: string;
        folderName: string;
        updatedAt: Date;
        tags?: string[];
      }>
    >();

  const allFolders = await FolderModel.find({}, { _id: 1, parentId: 1 }).lean<
    Array<{ _id: Types.ObjectId; parentId: Types.ObjectId | null }>
  >();
  const allFiles = await UploadedFileModel.find(ACTIVE_FILE_FILTER, { folderId: 1 }).lean<
    Array<{ folderId: Types.ObjectId | null }>
  >();

  const childrenByParent = new Map<string, string[]>();

  for (const item of allFolders) {
    const parentId = toIdString(item.parentId);

    if (!parentId) {
      continue;
    }

    const currentChildren = childrenByParent.get(parentId) || [];
    currentChildren.push(String(item._id));
    childrenByParent.set(parentId, currentChildren);
  }

  const directFileCounts = new Map<string, number>();

  for (const file of allFiles) {
    const currentFolderId = toIdString(file.folderId);

    if (!currentFolderId) {
      continue;
    }

    directFileCounts.set(currentFolderId, (directFileCounts.get(currentFolderId) || 0) + 1);
  }

  const totalFileCounts = new Map<string, number>();

  const countFilesInFolder = (currentFolderId: string): number => {
    const cached = totalFileCounts.get(currentFolderId);

    if (cached !== undefined) {
      return cached;
    }

    const ownFiles = directFileCounts.get(currentFolderId) || 0;
    const childIds = childrenByParent.get(currentFolderId) || [];
    const total =
      ownFiles + childIds.reduce((sum, childId) => sum + countFilesInFolder(childId), 0);

    totalFileCounts.set(currentFolderId, total);
    return total;
  };

  return {
    currentFolder: folder
      ? {
          id: String(folder._id),
          name: folder.name,
          parentId: toIdString(folder.parentId)
        }
      : {
          id: ROOT_FOLDER_ID,
          name: ROOT_FOLDER_NAME,
          parentId: null
        },
    breadcrumbs: await getFolderBreadcrumbs(folderId),
    folders: childFolders.map((item) => ({
      id: String(item._id),
      name: item.name,
      parentId: toIdString(item.parentId),
      updatedAt: item.updatedAt,
      fileCount: countFilesInFolder(String(item._id))
    })),
    files: files.map((item) => ({
      id: String(item._id),
      name: item.name,
      originalName: item.originalName,
      size: item.size,
      type: item.type,
      folderName: item.folderName,
      updatedAt: item.updatedAt,
      tags: item.tags || []
    })),
    tree: await createFolderTree(),
    duplicateGroups: folderId ? [] : await getDuplicateGroups()
  };
};

const ensureFolderCanMove = async (folderId: string, targetParentId: string | null) => {
  if (folderId === targetParentId) {
    throw new Error("A folder cannot be moved into itself.");
  }

  if (!targetParentId) {
    return;
  }

  let currentParentId: string | null = targetParentId;

  while (currentParentId) {
    if (currentParentId === folderId) {
      throw new Error("A folder cannot be moved into its own descendant.");
    }

    const parentFolder = await FolderModel.findById(currentParentId)
      .select({ parentId: 1 })
      .exec();
    currentParentId = parentFolder?.parentId ? String(parentFolder.parentId) : null;
  }
};

const duplicateFolderRecursively = async (
  sourceFolderId: string,
  targetParentId: string | null
) => {
  const sourceFolder = await FolderModel.findById(sourceFolderId).lean<{
    _id: Types.ObjectId;
    name: string;
    parentId: Types.ObjectId | null;
  } | null>();

  if (!sourceFolder) {
    throw new Error("Folder not found.");
  }

  const copyName = validateFolderName(`${sourceFolder.name}-copy`);
  const sourceChildren = await FolderModel.find(
    { parentId: sourceFolder._id },
    { _id: 1 }
  ).lean<Array<{ _id: Types.ObjectId }>>();
  const sourceFiles = await UploadedFileModel.find({ folderId: sourceFolder._id }).lean<
    Array<{
      _id: Types.ObjectId;
      name: string;
      originalName: string;
      size: number;
      type: string;
      path: string;
      extension: string;
      category: string;
      contentHash: string;
      tags?: string[];
    }>
  >();

  const newFolder = await FolderModel.create({
    name: copyName,
    parentId: targetParentId ? new Types.ObjectId(targetParentId) : null
  });

  const { pathMap } = await getAllFolderPathMap();
  const sourceRelativePath = pathMap.get(sourceFolderId);
  const newRelativePath = pathMap.get(String(newFolder._id));

  if (!sourceRelativePath || !newRelativePath) {
    throw new Error("Failed to resolve folder paths.");
  }

  const uploadRoot = getUploadRootAbsolutePath();
  const sourceAbsolutePath = path.join(uploadRoot, sourceRelativePath);
  const newAbsolutePath = path.join(uploadRoot, newRelativePath);
  await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true });
  await fs.cp(sourceAbsolutePath, newAbsolutePath, { recursive: true });

  for (const sourceFile of sourceFiles) {
    const newFilePath = path.join(newRelativePath, sourceFile.name);
    await UploadedFileModel.create({
      folderId: newFolder._id,
      folderName: newFolder.name,
      name: sourceFile.name,
      originalName: sourceFile.originalName,
      extension: sourceFile.extension,
      category: sourceFile.category,
      size: sourceFile.size,
      type: sourceFile.type,
      path: newFilePath,
      contentHash: sourceFile.contentHash,
      tags: sourceFile.tags || []
    });
  }

  for (const child of sourceChildren) {
    await duplicateFolderRecursively(String(child._id), String(newFolder._id));
  }
};

export const getManagerRoot = async (_req: Request, res: Response) => {
  try {
    await ensureUploadRoot();
    return res.status(200).json(await getFolderContentsPayload(null));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load file manager.";
    return res.status(400).json({ message });
  }
};

export const getManagerFolderContents = async (req: Request, res: Response) => {
  try {
    return res
      .status(200)
      .json(await getFolderContentsPayload(getSingleParam(req.params.folderId)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load folder contents.";
    return res.status(400).json({ message });
  }
};

export const getGlobalSearchResults = async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    const includeContent =
      String(req.query.includeContent || "").trim().toLowerCase() === "true" ||
      String(req.query.includeContent || "").trim() === "1";

    if (!query) {
      return res.status(200).json({
        query,
        includeContent,
        totals: {
          folders: 0,
          files: 0
        },
        folders: [],
        files: []
      });
    }

    const normalizedQuery = query.toLowerCase();
    const { pathMap } = await getAllFolderPathMap();
    const folders = await FolderModel.find({}, { name: 1, parentId: 1 }).lean<
      Array<{ _id: Types.ObjectId; name: string; parentId: Types.ObjectId | null }>
    >();
    const files = await UploadedFileModel.find(
      ACTIVE_FILE_FILTER,
      {
        name: 1,
        originalName: 1,
        folderName: 1,
        path: 1,
        extension: 1,
        category: 1,
        size: 1,
        updatedAt: 1,
        type: 1
      }
    )
      .sort({ updatedAt: -1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          name: string;
          originalName: string;
          folderName: string;
          path: string;
          extension: string;
          category: string;
          size: number;
          updatedAt: Date;
          type: string;
        }>
      >();

    const folderResults = folders
      .map((folder) => {
        const folderPath = pathMap.get(String(folder._id));
        const pathLabel = getFolderPathLabel(folderPath);
        const matchedFields = [
          folder.name.toLowerCase().includes(normalizedQuery) ? "name" : null,
          pathLabel.toLowerCase().includes(normalizedQuery) ? "path" : null
        ].filter((value): value is string => Boolean(value));

        if (!matchedFields.length) {
          return null;
        }

        return {
          id: String(folder._id),
          name: folder.name,
          path: pathLabel,
          matchedFields
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.path.localeCompare(right.path));

    const fileResults = [];

    for (const file of files) {
      const matchedFields = [
        file.name.toLowerCase().includes(normalizedQuery) ? "name" : null,
        file.originalName.toLowerCase().includes(normalizedQuery) ? "originalName" : null,
        file.extension.toLowerCase().includes(normalizedQuery) ? "extension" : null,
        file.category.toLowerCase().includes(normalizedQuery) ? "category" : null,
        file.folderName.toLowerCase().includes(normalizedQuery) ? "folder" : null,
        getFilePathLabel(file.path).toLowerCase().includes(normalizedQuery) ? "path" : null
      ].filter((value): value is string => Boolean(value));

      let snippet: string | null = null;

      if (!matchedFields.length && includeContent) {
        try {
          const content = await extractSearchableContent(
            resolveAbsoluteFilePath(file.path),
            file.extension || normalizeExtension(file.name),
            file.category || getFileCategory(file.extension, file.type)
          );
          snippet = content ? buildSnippet(content, query) : null;
        } catch {
          snippet = null;
        }

        if (snippet) {
          matchedFields.push("content");
        }
      }

      if (!matchedFields.length) {
        continue;
      }

      fileResults.push({
        id: String(file._id),
        name: file.name,
        originalName: file.originalName,
        folderName: file.folderName,
        path: getFilePathLabel(file.path),
        extension: file.extension,
        category: file.category,
        size: file.size,
        updatedAt: file.updatedAt,
        matchedFields,
        snippet
      });
    }

    return res.status(200).json({
      query,
      includeContent,
      totals: {
        folders: folderResults.length,
        files: fileResults.length
      },
      folders: folderResults,
      files: fileResults
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search workspace.";
    return res.status(400).json({ message });
  }
};

export const getDuplicateFiles = async (_req: Request, res: Response) => {
  try {
    const groups = await getDuplicateGroups();
    return res.status(200).json({
      groups,
      summary: {
        duplicateGroupCount: groups.length,
        duplicateFileCount: groups.reduce((sum, group) => sum + group.count, 0),
        wastedBytes: groups.reduce((sum, group) => sum + group.wastedBytes, 0)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load duplicate files.";
    return res.status(400).json({ message });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const name = validateFolderName(String(req.body.name || ""));
    const parentId = getTargetParentId(req.body.parentId);

    const folder = await FolderModel.create({
      name,
      parentId: parentId ? new Types.ObjectId(parentId) : null
    });

    const { pathMap } = await getAllFolderPathMap();
    const relativePath = pathMap.get(String(folder._id));

    if (!relativePath) {
      throw new Error("Failed to create folder path.");
    }

    await fs.mkdir(path.join(getUploadRootAbsolutePath(), relativePath), {
      recursive: true
    });

    return res.status(201).json({
      folder: {
        id: String(folder._id),
        name: folder.name,
        parentId: toIdString(folder.parentId)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create folder.";
    return res.status(400).json({ message });
  }
};

export const renameFolder = async (req: Request, res: Response) => {
  try {
    const folderId = getSingleParam(req.params.folderId);
    const name = validateFolderName(String(req.body.name || ""));
    const { pathMap: beforePathMap } = await getAllFolderPathMap();
    const beforeRelativePath = beforePathMap.get(folderId);

    const folder = await FolderModel.findByIdAndUpdate(
      folderId,
      { name },
      { new: true }
    ).lean<{ _id: Types.ObjectId; name: string; parentId: Types.ObjectId | null } | null>();

    if (!folder || !beforeRelativePath) {
      throw new Error("Folder not found.");
    }

    const { pathMap: afterPathMap } = await getAllFolderPathMap();
    const afterRelativePath = afterPathMap.get(folderId);

    if (!afterRelativePath) {
      throw new Error("Failed to resolve renamed folder path.");
    }

    const uploadRoot = getUploadRootAbsolutePath();
    await fs.mkdir(path.dirname(path.join(uploadRoot, afterRelativePath)), {
      recursive: true
    });
    await fs.rename(
      path.join(uploadRoot, beforeRelativePath),
      path.join(uploadRoot, afterRelativePath)
    );

    await UploadedFileModel.updateMany(
      {
        path: {
          $regex: `^${beforeRelativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
        }
      },
      [
        {
          $set: {
            path: {
              $replaceOne: {
                input: "$path",
                find: beforeRelativePath,
                replacement: afterRelativePath
              }
            }
          }
        }
      ]
    );

    await UploadedFileModel.updateMany(
      { folderId: new Types.ObjectId(folderId) },
      { folderName: folder.name }
    );

    return res.status(200).json({ message: "Folder renamed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename folder.";
    return res.status(400).json({ message });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const folderId = getSingleParam(req.params.folderId);
    const { pathMap } = await getAllFolderPathMap();
    const folderPath = pathMap.get(folderId);

    if (!folderPath) {
      throw new Error("Folder not found.");
    }

    const allFolders = await FolderModel.find({}, { _id: 1, parentId: 1 }).lean<
      Array<{ _id: Types.ObjectId; parentId: Types.ObjectId | null }>
    >();
    const descendantIds = new Set([folderId]);
    let changed = true;

    while (changed) {
      changed = false;

      for (const folder of allFolders) {
        const parentId = toIdString(folder.parentId);
        const currentId = String(folder._id);

        if (parentId && descendantIds.has(parentId) && !descendantIds.has(currentId)) {
          descendantIds.add(currentId);
          changed = true;
        }
      }
    }

    await UploadedFileModel.deleteMany({
      folderId: { $in: Array.from(descendantIds).map((id) => new Types.ObjectId(id)) }
    });
    await FolderModel.deleteMany({
      _id: { $in: Array.from(descendantIds).map((id) => new Types.ObjectId(id)) }
    });
    await fs.rm(path.join(getUploadRootAbsolutePath(), folderPath), {
      recursive: true,
      force: true
    });

    return res.status(200).json({ message: "Folder deleted." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete folder.";
    return res.status(400).json({ message });
  }
};

export const moveFolder = async (req: Request, res: Response) => {
  try {
    const folderId = getSingleParam(req.params.folderId);
    const targetParentId = getTargetParentId(req.body.targetParentId);
    await ensureFolderCanMove(folderId, targetParentId);

    const { pathMap: beforePathMap } = await getAllFolderPathMap();
    const beforeRelativePath = beforePathMap.get(folderId);

    if (!beforeRelativePath) {
      throw new Error("Folder not found.");
    }

    await FolderModel.findByIdAndUpdate(folderId, {
      parentId: targetParentId ? new Types.ObjectId(targetParentId) : null
    });

    const { pathMap: afterPathMap } = await getAllFolderPathMap();
    const afterRelativePath = afterPathMap.get(folderId);

    if (!afterRelativePath) {
      throw new Error("Failed to resolve moved folder path.");
    }

    const uploadRoot = getUploadRootAbsolutePath();
    await fs.mkdir(path.dirname(path.join(uploadRoot, afterRelativePath)), {
      recursive: true
    });
    await fs.rename(
      path.join(uploadRoot, beforeRelativePath),
      path.join(uploadRoot, afterRelativePath)
    );

    await UploadedFileModel.updateMany(
      {
        path: {
          $regex: `^${beforeRelativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
        }
      },
      [
        {
          $set: {
            path: {
              $replaceOne: {
                input: "$path",
                find: beforeRelativePath,
                replacement: afterRelativePath
              }
            }
          }
        }
      ]
    );

    return res.status(200).json({ message: "Folder moved." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move folder.";
    return res.status(400).json({ message });
  }
};

export const copyFolder = async (req: Request, res: Response) => {
  try {
    const folderId = getSingleParam(req.params.folderId);
    const targetParentId = getTargetParentId(req.body.targetParentId);
    await ensureFolderCanMove(folderId, targetParentId);
    await duplicateFolderRecursively(folderId, targetParentId);
    return res.status(200).json({ message: "Folder copied." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to copy folder.";
    return res.status(400).json({ message });
  }
};

export const renameFile = async (req: Request, res: Response) => {
  try {
    const fileId = getSingleParam(req.params.fileId);
    const name = validateFileName(String(req.body.name || ""));
    const file = await UploadedFileModel.findById(fileId).lean<{
      _id: Types.ObjectId;
      folderId: Types.ObjectId;
      folderName: string;
      path: string;
      originalName: string;
      type: string;
    } | null>();

    if (!file) {
      throw new Error("File not found.");
    }

    const nextRelativePath = path.join(path.dirname(file.path), name);
    const extension = normalizeExtension(name);
    const category = getFileCategory(extension, file.type);
    await fs.rename(
      resolveAbsoluteFilePath(file.path),
      resolveAbsoluteFilePath(nextRelativePath)
    );

    await UploadedFileModel.findByIdAndUpdate(fileId, {
      name,
      originalName: name,
      extension,
      category,
      path: nextRelativePath
    });

    return res.status(200).json({ message: "File renamed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename file.";
    return res.status(400).json({ message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const fileId = getSingleParam(req.params.fileId);
    const file = await UploadedFileModel.findByIdAndDelete(fileId).lean<{
      path: string;
    } | null>();

    if (!file) {
      throw new Error("File not found.");
    }

    await fs.rm(resolveAbsoluteFilePath(file.path), { force: true });
    return res.status(200).json({ message: "File deleted." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete file.";
    return res.status(400).json({ message });
  }
};

export const moveFile = async (req: Request, res: Response) => {
  try {
    const fileId = getSingleParam(req.params.fileId);
    const targetFolderId = String(req.body.targetFolderId || "").trim();

    if (!targetFolderId || targetFolderId === ROOT_FOLDER_ID) {
      throw new Error("Choose a destination folder.");
    }

    const file = await UploadedFileModel.findById(fileId).lean<{
      _id: Types.ObjectId;
      name: string;
      originalName: string;
      size: number;
      type: string;
      path: string;
      extension: string;
      category: string;
    } | null>();
    const folder = await FolderModel.findById(targetFolderId).lean<{
      _id: Types.ObjectId;
      name: string;
    } | null>();

    if (!file || !folder) {
      throw new Error("File or destination folder not found.");
    }

    const { pathMap } = await getAllFolderPathMap();
    const targetFolderPath = pathMap.get(targetFolderId);

    if (!targetFolderPath) {
      throw new Error("Failed to resolve destination folder path.");
    }

    const nextRelativePath = path.join(targetFolderPath, file.name);
    await fs.rename(
      resolveAbsoluteFilePath(file.path),
      resolveAbsoluteFilePath(nextRelativePath)
    );

    await UploadedFileModel.findByIdAndUpdate(fileId, {
      folderId: folder._id,
      folderName: folder.name,
      path: nextRelativePath
    });

    return res.status(200).json({ message: "File moved." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move file.";
    return res.status(400).json({ message });
  }
};

export const copyFile = async (req: Request, res: Response) => {
  try {
    const fileId = getSingleParam(req.params.fileId);
    const targetFolderId = String(req.body.targetFolderId || "").trim();

    if (!targetFolderId || targetFolderId === ROOT_FOLDER_ID) {
      throw new Error("Choose a destination folder.");
    }

    const file = await UploadedFileModel.findById(fileId).lean<{
      _id: Types.ObjectId;
      name: string;
      originalName: string;
      size: number;
      type: string;
      path: string;
      extension: string;
      category: string;
      contentHash: string;
      tags?: string[];
    } | null>();
    const folder = await FolderModel.findById(targetFolderId).lean<{
      _id: Types.ObjectId;
      name: string;
    } | null>();

    if (!file || !folder) {
      throw new Error("File or destination folder not found.");
    }

    const { pathMap } = await getAllFolderPathMap();
    const targetFolderPath = pathMap.get(targetFolderId);

    if (!targetFolderPath) {
      throw new Error("Failed to resolve destination folder path.");
    }

    const copiedName = validateFileName(`copy-${file.name}`);
    const nextRelativePath = path.join(targetFolderPath, copiedName);

    await fs.copyFile(
      resolveAbsoluteFilePath(file.path),
      resolveAbsoluteFilePath(nextRelativePath)
    );

    await UploadedFileModel.create({
      folderId: folder._id,
      folderName: folder.name,
      name: copiedName,
      originalName: copiedName,
      extension: file.extension || normalizeExtension(copiedName),
      category: file.category || getFileCategory(normalizeExtension(copiedName), file.type),
      size: file.size,
      type: file.type,
      path: nextRelativePath,
      contentHash:
        file.contentHash || (await computeFileHashFromPath(resolveAbsoluteFilePath(nextRelativePath))),
      tags: file.tags || []
    });

    return res.status(200).json({ message: "File copied." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to copy file.";
    return res.status(400).json({ message });
  }
};

export const bulkMoveItems = async (req: Request, res: Response) => {
  try {
    const { folderIds, fileIds } = getBulkSelection(req.body);
    const targetFolderId = String(req.body.targetFolderId || "").trim();

    if (!targetFolderId || targetFolderId === ROOT_FOLDER_ID) {
      throw new Error("Choose a destination folder.");
    }

    const destinationFolder = await FolderModel.findById(targetFolderId).lean<{
      _id: Types.ObjectId;
      name: string;
    } | null>();

    if (!destinationFolder) {
      throw new Error("Destination folder not found.");
    }

    const beforePathMap = (await getAllFolderPathMap()).pathMap;

    for (const folderId of folderIds) {
      await ensureFolderCanMove(folderId, targetFolderId);
    }

    for (const folderId of folderIds) {
      const beforeRelativePath = beforePathMap.get(folderId);

      if (!beforeRelativePath) {
        continue;
      }

      await FolderModel.findByIdAndUpdate(folderId, {
        parentId: new Types.ObjectId(targetFolderId)
      });

      const afterRelativePath = (await getAllFolderPathMap()).pathMap.get(folderId);

      if (!afterRelativePath) {
        continue;
      }

      const uploadRoot = getUploadRootAbsolutePath();
      await fs.mkdir(path.dirname(path.join(uploadRoot, afterRelativePath)), {
        recursive: true
      });
      await fs.rename(
        path.join(uploadRoot, beforeRelativePath),
        path.join(uploadRoot, afterRelativePath)
      );

      await UploadedFileModel.updateMany(
        {
          path: {
            $regex: `^${beforeRelativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
          }
        },
        [
          {
            $set: {
              path: {
                $replaceOne: {
                  input: "$path",
                  find: beforeRelativePath,
                  replacement: afterRelativePath
                }
              }
            }
          }
        ]
      );
    }

    if (fileIds.length) {
      const { pathMap } = await getAllFolderPathMap();
      const targetFolderPath = pathMap.get(targetFolderId);

      if (!targetFolderPath) {
        throw new Error("Failed to resolve destination folder path.");
      }

      const files = await UploadedFileModel.find({
        _id: { $in: fileIds.map((id) => new Types.ObjectId(id)) },
        ...ACTIVE_FILE_FILTER
      }).lean<Array<{ _id: Types.ObjectId; name: string; path: string }>>();

      for (const file of files) {
        const nextRelativePath = path.join(targetFolderPath, file.name);
        await fs.rename(
          resolveAbsoluteFilePath(file.path),
          resolveAbsoluteFilePath(nextRelativePath)
        );
        await UploadedFileModel.findByIdAndUpdate(file._id, {
          folderId: destinationFolder._id,
          folderName: destinationFolder.name,
          path: nextRelativePath
        });
      }
    }

    return res.status(200).json({ message: "Bulk move completed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move selected items.";
    return res.status(400).json({ message });
  }
};

export const bulkDeleteItems = async (req: Request, res: Response) => {
  try {
    const selection = getBulkSelection(req.body);
    const descendantFolderIds = selection.folderIds.length
      ? await collectDescendantFolderIds(selection.folderIds)
      : [];

    if (descendantFolderIds.length) {
      const { pathMap } = await getAllFolderPathMap();

      await UploadedFileModel.deleteMany({
        folderId: { $in: descendantFolderIds.map((id) => new Types.ObjectId(id)) }
      });
      await FolderModel.deleteMany({
        _id: { $in: descendantFolderIds.map((id) => new Types.ObjectId(id)) }
      });

      for (const folderId of selection.folderIds) {
        const folderPath = pathMap.get(folderId);
        if (folderPath) {
          await fs.rm(path.join(getUploadRootAbsolutePath(), folderPath), {
            recursive: true,
            force: true
          });
        }
      }
    }

    if (selection.fileIds.length) {
      const files = await UploadedFileModel.find({
        _id: { $in: selection.fileIds.map((id) => new Types.ObjectId(id)) }
      }).lean<Array<{ _id: Types.ObjectId; path: string }>>();

      for (const file of files) {
        await fs.rm(resolveAbsoluteFilePath(file.path), { force: true });
      }

      await UploadedFileModel.deleteMany({
        _id: { $in: selection.fileIds.map((id) => new Types.ObjectId(id)) }
      });
    }

    return res.status(200).json({ message: "Bulk delete completed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete selected items.";
    return res.status(400).json({ message });
  }
};

export const bulkTagItems = async (req: Request, res: Response) => {
  try {
    const selection = getBulkSelection(req.body);
    const tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    if (!tags.length) {
      throw new Error("Enter at least one tag.");
    }

    const descendantFolderIds = selection.folderIds.length
      ? await collectDescendantFolderIds(selection.folderIds)
      : [];

    const orFilters: Array<Record<string, unknown>> = [];

    if (selection.fileIds.length) {
      orFilters.push({
        _id: { $in: selection.fileIds.map((id) => new Types.ObjectId(id)) }
      });
    }

    if (descendantFolderIds.length) {
      orFilters.push({
        folderId: { $in: descendantFolderIds.map((id) => new Types.ObjectId(id)) }
      });
    }

    await UploadedFileModel.updateMany(
      orFilters.length === 1 ? orFilters[0] : { $or: orFilters },
      {
        $addToSet: {
          tags: { $each: tags }
        }
      }
    );

    return res.status(200).json({ message: "Bulk tag update completed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to tag selected items.";
    return res.status(400).json({ message });
  }
};

export const bulkDownloadItems = async (req: Request, res: Response) => {
  try {
    const selection = getBulkSelection(req.body);
    const descendantFolderIds = selection.folderIds.length
      ? await collectDescendantFolderIds(selection.folderIds)
      : [];
    const folderFiles = descendantFolderIds.length
      ? await UploadedFileModel.find({
          folderId: { $in: descendantFolderIds.map((id) => new Types.ObjectId(id)) },
          ...ACTIVE_FILE_FILTER
        }).lean<Array<{ _id: Types.ObjectId; path: string }>>()
      : [];
    const directFiles = selection.fileIds.length
      ? await UploadedFileModel.find({
          _id: { $in: selection.fileIds.map((id) => new Types.ObjectId(id)) },
          ...ACTIVE_FILE_FILTER
        }).lean<Array<{ _id: Types.ObjectId; path: string }>>()
      : [];

    const archive = archiver("zip", { zlib: { level: 9 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="manager-download.zip"');
    archive.pipe(res);

    const seenPaths = new Set<string>();

    for (const file of [...folderFiles, ...directFiles]) {
      if (seenPaths.has(file.path)) {
        continue;
      }

      seenPaths.add(file.path);
      await appendZipFile(archive, resolveAbsoluteFilePath(file.path), file.path);
    }

    await archive.finalize();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download selected items.";
    return res.status(400).json({ message });
  }
};

export const bulkExportItems = async (req: Request, res: Response) => {
  try {
    const selection = getBulkSelection(req.body);
    const descendantFolderIds = selection.folderIds.length
      ? await collectDescendantFolderIds(selection.folderIds)
      : [];
    const orFilters: Array<Record<string, unknown>> = [];

    if (selection.fileIds.length) {
      orFilters.push({
        _id: { $in: selection.fileIds.map((id) => new Types.ObjectId(id)) }
      });
    }

    if (descendantFolderIds.length) {
      orFilters.push({
        folderId: { $in: descendantFolderIds.map((id) => new Types.ObjectId(id)) }
      });
    }

    const files = await UploadedFileModel.find(
      {
        ...(orFilters.length === 1 ? orFilters[0] : { $or: orFilters }),
        ...ACTIVE_FILE_FILTER
      },
      { name: 1, path: 1, extension: 1, category: 1 }
    ).lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        path: string;
        extension: string;
        category: string;
      }>
    >();

    const archive = archiver("zip", { zlib: { level: 9 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="manager-export.zip"');
    archive.pipe(res);

    const exportManifest: Array<{ name: string; mode: string }> = [];

    for (const file of files) {
      if (file.category === "table") {
        const content = await extractSearchableContent(
          resolveAbsoluteFilePath(file.path),
          file.extension,
          file.category
        );
        archive.append(content, {
          name: path.join("tables", `${path.parse(file.name).name}.csv`)
        });
        exportManifest.push({ name: file.name, mode: "csv" });
      } else {
        await appendZipFile(
          archive,
          resolveAbsoluteFilePath(file.path),
          path.join("originals", file.name)
        );
        exportManifest.push({ name: file.name, mode: "original" });
      }
    }

    archive.append(JSON.stringify(exportManifest, null, 2), { name: "manifest.json" });
    await archive.finalize();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export selected items.";
    return res.status(400).json({ message });
  }
};
