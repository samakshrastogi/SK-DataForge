import fs from "fs/promises";
import path from "path";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { getFileCategory, isSupportedFileType } from "../constants/uploads";
import { FolderModel } from "../models/Folder";
import { ImportSourceModel } from "../models/ImportSource";
import { RetentionRuleModel } from "../models/RetentionRule";
import { UploadedFileModel } from "../models/UploadedFile";
import {
  createNotification,
  evaluateQuotaNotifications
} from "../services/notificationService";
import {
  computeFileHashFromBuffer,
  resolveAbsoluteFilePath
} from "../utils/fileIntelligence";
import {
  ensureUploadRoot,
  getAllFolderPathMap,
  getUploadRootAbsolutePath,
  ROOT_FOLDER_ID,
  validateFolderName
} from "../utils/fileManager";
import { sanitizeFileName } from "../utils/uploadPaths";

const SCHEDULER_TICK_MS = 60_000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

const toIdString = (value: Types.ObjectId | string | null | undefined) =>
  value ? String(value) : null;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

const providerSupportsAutomatedRun = (provider: string) =>
  provider === "url" || provider === "local-folder";

const folderFilterFromBody = (value: unknown) => {
  const folderId = String(value || "").trim();
  if (!folderId || folderId === ROOT_FOLDER_ID) {
    return null;
  }

  return new Types.ObjectId(folderId);
};

const ensureDefaultImportFolderId = async () => {
  const folder = await FolderModel.findOneAndUpdate(
    { name: "Imported", parentId: null },
    { $setOnInsert: { name: "Imported", parentId: null } },
    { upsert: true, new: true }
  ).lean<{ _id: Types.ObjectId }>();

  if (!folder) {
    throw new Error("Failed to create default import folder.");
  }

  return String(folder._id);
};

const ensureFolderHierarchy = async (
  baseFolderId: string | null,
  folderSegments: string[]
): Promise<{ folderId: Types.ObjectId | null; folderName: string }> => {
  let currentFolderId = baseFolderId ? new Types.ObjectId(baseFolderId) : null;
  let currentFolderName = "Home";

  for (const rawSegment of folderSegments) {
    const segment = validateFolderName(rawSegment);
    const folder = await FolderModel.findOneAndUpdate(
      { name: segment, parentId: currentFolderId },
      { $setOnInsert: { name: segment, parentId: currentFolderId } },
      { upsert: true, new: true }
    ).lean<{ _id: Types.ObjectId; name: string }>();
    if (!folder) {
      throw new Error("Failed to create import folder hierarchy.");
    }
    currentFolderId = folder._id;
    currentFolderName = folder.name;
  }

  return {
    folderId: currentFolderId,
    folderName: currentFolderName
  };
};

const buildRelativePathForFolder = async (folderId: string | null) => {
  if (!folderId) {
    return "";
  }

  const { pathMap } = await getAllFolderPathMap();
  return pathMap.get(folderId) || "";
};

const saveImportedBuffer = async ({
  folderId,
  fileName,
  originalName,
  mimeType,
  buffer
}: {
  folderId: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}) => {
  await ensureUploadRoot();
  const resolvedFolderId = folderId || (await ensureDefaultImportFolderId());
  const normalizedName = sanitizeFileName(fileName);
  const relativeFolderPath = await buildRelativePathForFolder(resolvedFolderId);
  const relativeFilePath = relativeFolderPath
    ? path.join(relativeFolderPath, normalizedName)
    : normalizedName;
  const absoluteFilePath = path.join(getUploadRootAbsolutePath(), relativeFilePath);
  const extension = path.extname(normalizedName).toLowerCase();
  const category = getFileCategory(extension, mimeType);
  const contentHash = computeFileHashFromBuffer(buffer);

  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
  await fs.writeFile(absoluteFilePath, buffer);

  const folderLabel =
    folderId && relativeFolderPath
      ? path.basename(relativeFolderPath)
      : relativeFolderPath || "Home";

  const saved = await UploadedFileModel.findOneAndUpdate(
    {
      folderId: new Types.ObjectId(resolvedFolderId),
      name: normalizedName
    },
    {
      folderId: new Types.ObjectId(resolvedFolderId),
      folderName: folderLabel,
      name: normalizedName,
      originalName,
      extension,
      category,
      size: buffer.byteLength,
      type: mimeType || "application/octet-stream",
      path: relativeFilePath,
      contentHash,
      lifecycleStatus: "active",
      archivedAt: null
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return saved;
};

const detectMimeTypeFromName = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".csv") return "text/csv";
  if (extension === ".json") return "application/json";
  if (extension === ".txt" || extension === ".log" || extension === ".md") return "text/plain";
  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (extension === ".xls") return "application/vnd.ms-excel";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";

  return "application/octet-stream";
};

const importUrlSource = async (source: {
  _id: Types.ObjectId;
  sourceUrl: string;
  targetFolderId: Types.ObjectId | null;
  urlMode?: string;
}) => {
  const urlValue = source.sourceUrl.trim();
  if (!urlValue) {
    throw new Error("Source URL is required.");
  }

  const response = await fetch(urlValue);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const urlPathName = new URL(urlValue).pathname;
  const inferredName = path.basename(urlPathName) || `import-${Date.now()}.bin`;

  if (source.urlMode === "manifest") {
    const manifest = (await response.json()) as Array<{ url: string; fileName?: string }>;
    let importedCount = 0;

    for (const entry of manifest) {
      const entryResponse = await fetch(entry.url);
      if (!entryResponse.ok) {
        continue;
      }

      const entryBuffer = Buffer.from(await entryResponse.arrayBuffer());
      const entryUrlPath = new URL(entry.url).pathname;
      const entryName = entry.fileName || path.basename(entryUrlPath) || `import-${Date.now()}.bin`;
      await saveImportedBuffer({
        folderId: toIdString(source.targetFolderId),
        fileName: entryName,
        originalName: entryName,
        mimeType: entryResponse.headers.get("content-type") || detectMimeTypeFromName(entryName),
        buffer: entryBuffer
      });
      importedCount += 1;
    }

    return importedCount;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await saveImportedBuffer({
    folderId: toIdString(source.targetFolderId),
    fileName: inferredName,
    originalName: inferredName,
    mimeType: contentType,
    buffer
  });

  return 1;
};

const importLocalFolderSource = async (source: {
  _id: Types.ObjectId;
  sourcePath: string;
  targetFolderId: Types.ObjectId | null;
}) => {
  const basePath = path.resolve(source.sourcePath.trim());
  const importedFiles: string[] = [];

  const walk = async (currentPath: string, relativeSegments: string[] = []) => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const absoluteEntryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absoluteEntryPath, [...relativeSegments, entry.name]);
        continue;
      }

      const mimeType = detectMimeTypeFromName(entry.name);
      if (!isSupportedFileType(path.extname(entry.name).toLowerCase(), mimeType)) {
        continue;
      }

      const targetFolder = await ensureFolderHierarchy(
        toIdString(source.targetFolderId),
        relativeSegments
      );
      const buffer = await fs.readFile(absoluteEntryPath);
      await saveImportedBuffer({
        folderId: toIdString(targetFolder.folderId),
        fileName: entry.name,
        originalName: entry.name,
        mimeType,
        buffer
      });
      importedFiles.push(absoluteEntryPath);
    }
  };

  await walk(basePath);
  return importedFiles.length;
};

export const runImportSourceJob = async (sourceId: string) => {
  const source = await ImportSourceModel.findById(sourceId).lean<{
    _id: Types.ObjectId;
    provider: string;
    sourceUrl: string;
    sourcePath: string;
    targetFolderId: Types.ObjectId | null;
    urlMode?: string;
  } | null>();

  if (!source) {
    throw new Error("Import source not found.");
  }

  let importedCount = 0;

  if (source.provider === "url") {
    importedCount = await importUrlSource(source);
  } else if (source.provider === "local-folder") {
    importedCount = await importLocalFolderSource(source);
  } else {
    throw new Error(
      "This connector type is configured, but automated ingestion currently requires a direct URL or local folder path."
    );
  }

  await ImportSourceModel.findByIdAndUpdate(sourceId, {
    lastRunAt: new Date(),
    lastImportedCount: importedCount,
    lastError: ""
  });
  await createNotification({
    type: "processing_completed",
    title: "Scheduled ingestion completed",
    message: `${importedCount} file(s) were ingested from the configured ${source.provider} source.`,
    metadata: {
      sourceId,
      provider: source.provider,
      importedCount
    }
  });
  await evaluateQuotaNotifications();

  return importedCount;
};

const collectDescendantFolderIds = async (folderId: string) => {
  const folders = await FolderModel.find({}, { _id: 1, parentId: 1 }).lean<
    Array<{ _id: Types.ObjectId; parentId: Types.ObjectId | null }>
  >();
  const descendantIds = new Set([folderId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const folder of folders) {
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

const archiveFile = async (file: { _id: Types.ObjectId; path: string; lifecycleStatus?: string }) => {
  if (file.lifecycleStatus === "archived") {
    return;
  }

  const archiveRelativePath = path.join("_archive", file.path);
  const sourcePath = resolveAbsoluteFilePath(file.path);
  const archivePath = resolveAbsoluteFilePath(archiveRelativePath);

  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  await fs.rename(sourcePath, archivePath);
  await UploadedFileModel.findByIdAndUpdate(file._id, {
    path: archiveRelativePath,
    lifecycleStatus: "archived",
    archivedAt: new Date()
  });
};

export const runRetentionRuleJob = async (ruleId: string) => {
  const rule = await RetentionRuleModel.findById(ruleId).lean<{
    _id: Types.ObjectId;
    action: "archive" | "delete";
    maxAgeDays: number;
    targetFolderId: Types.ObjectId | null;
    tagFilter: string[];
  } | null>();

  if (!rule) {
    throw new Error("Retention rule not found.");
  }

  const threshold = new Date(Date.now() - rule.maxAgeDays * 24 * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    lifecycleStatus: "active",
    updatedAt: { $lt: threshold }
  };

  if (rule.tagFilter.length > 0) {
    filter.tags = { $in: rule.tagFilter };
  }

  if (rule.targetFolderId) {
    const folderIds = await collectDescendantFolderIds(String(rule.targetFolderId));
    filter.folderId = { $in: folderIds.map((id) => new Types.ObjectId(id)) };
  }

  const files = await UploadedFileModel.find(filter).lean<
    Array<{ _id: Types.ObjectId; path: string; lifecycleStatus: string }>
  >();

  if (rule.action === "archive") {
    for (const file of files) {
      await archiveFile(file);
    }
  } else {
    for (const file of files) {
      await fs.rm(resolveAbsoluteFilePath(file.path), { force: true });
      await UploadedFileModel.findByIdAndDelete(file._id);
    }
  }

  await RetentionRuleModel.findByIdAndUpdate(ruleId, {
    lastRunAt: new Date(),
    lastAffectedCount: files.length,
    lastError: ""
  });

  return files.length;
};

const runScheduledJobs = async () => {
  if (isSchedulerRunning) {
    return;
  }

  isSchedulerRunning = true;

  try {
    const now = Date.now();
    const sources = await ImportSourceModel.find({ active: true }).lean<
      Array<{
        _id: Types.ObjectId;
        provider: string;
        scheduleMinutes: number;
        lastRunAt: Date | null;
      }>
    >();

    for (const source of sources) {
      if (!providerSupportsAutomatedRun(source.provider) || source.scheduleMinutes <= 0) {
        continue;
      }

      const lastRunTime = source.lastRunAt ? new Date(source.lastRunAt).getTime() : 0;
      const due = now - lastRunTime >= source.scheduleMinutes * 60 * 1000;
      if (!due) {
        continue;
      }

      try {
        await runImportSourceJob(String(source._id));
      } catch (error) {
        await createNotification({
          type: "failed_upload",
          title: "Scheduled ingestion failed",
          message: error instanceof Error ? error.message : "Scheduled ingestion failed.",
          metadata: {
            sourceId: String(source._id),
            provider: source.provider
          }
        });
        await ImportSourceModel.findByIdAndUpdate(source._id, {
          lastRunAt: new Date(),
          lastError: error instanceof Error ? error.message : "Scheduled import failed."
        });
      }
    }

    const rules = await RetentionRuleModel.find({ active: true }).lean<
      Array<{ _id: Types.ObjectId; lastRunAt: Date | null }>
    >();

    for (const rule of rules) {
      const lastRunTime = rule.lastRunAt ? new Date(rule.lastRunAt).getTime() : 0;
      const due = now - lastRunTime >= 24 * 60 * 60 * 1000;

      if (!due) {
        continue;
      }

      try {
        await runRetentionRuleJob(String(rule._id));
      } catch (error) {
        await RetentionRuleModel.findByIdAndUpdate(rule._id, {
          lastRunAt: new Date(),
          lastError: error instanceof Error ? error.message : "Retention run failed."
        });
      }
    }
  } finally {
    isSchedulerRunning = false;
  }
};

export const startAutomationScheduler = () => {
  if (schedulerHandle) {
    return;
  }

  schedulerHandle = setInterval(() => {
    void runScheduledJobs();
  }, SCHEDULER_TICK_MS);
  void runScheduledJobs();
};

export const getAutomationOverview = async (_req: Request, res: Response) => {
  try {
    const [sources, rules, folders] = await Promise.all([
      ImportSourceModel.find({}).sort({ createdAt: -1 }).lean(),
      RetentionRuleModel.find({}).sort({ createdAt: -1 }).lean(),
      FolderModel.find({}, { name: 1 }).sort({ name: 1 }).lean()
    ]);

    return res.status(200).json({
      sources: sources.map((source) => ({
        id: String(source._id),
        name: source.name,
        provider: source.provider,
        targetFolderId: toIdString(source.targetFolderId),
        sourceUrl: source.sourceUrl || "",
        sourcePath: source.sourcePath || "",
        urlMode: source.urlMode || "single-file",
        scheduleMinutes: source.scheduleMinutes || 0,
        active: source.active,
        lastRunAt: source.lastRunAt,
        lastImportedCount: source.lastImportedCount || 0,
        lastError: source.lastError || ""
      })),
      rules: rules.map((rule) => ({
        id: String(rule._id),
        name: rule.name,
        action: rule.action,
        maxAgeDays: rule.maxAgeDays,
        targetFolderId: toIdString(rule.targetFolderId),
        tagFilter: rule.tagFilter || [],
        active: rule.active,
        lastRunAt: rule.lastRunAt,
        lastAffectedCount: rule.lastAffectedCount || 0,
        lastError: rule.lastError || ""
      })),
      folders: [
        { id: ROOT_FOLDER_ID, name: "Home" },
        ...folders.map((folder) => ({
          id: String(folder._id),
          name: folder.name
        }))
      ],
      providers: [
        "url",
        "local-folder",
        "google-drive",
        "onedrive",
        "sharepoint",
        "s3",
        "azure-blob"
      ]
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load automation overview.";
    return res.status(400).json({ message });
  }
};

export const createImportSource = async (req: Request, res: Response) => {
  try {
    const source = await ImportSourceModel.create({
      name: String(req.body.name || "").trim(),
      provider: String(req.body.provider || "").trim(),
      targetFolderId: folderFilterFromBody(req.body.targetFolderId),
      sourceUrl: String(req.body.sourceUrl || "").trim(),
      sourcePath: String(req.body.sourcePath || "").trim(),
      urlMode: String(req.body.urlMode || "single-file").trim(),
      scheduleMinutes: Math.max(Number(req.body.scheduleMinutes || 0), 0),
      active: req.body.active !== false,
      options: req.body.options || {}
    });

    return res.status(201).json({ id: String(source._id) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create import source.";
    return res.status(400).json({ message });
  }
};

export const runImportSource = async (req: Request, res: Response) => {
  try {
    const importedCount = await runImportSourceJob(getSingleParam(req.params.sourceId));
    return res.status(200).json({ importedCount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run import source.";
    return res.status(400).json({ message });
  }
};

export const createRetentionRule = async (req: Request, res: Response) => {
  try {
    const rule = await RetentionRuleModel.create({
      name: String(req.body.name || "").trim(),
      action: String(req.body.action || "").trim(),
      maxAgeDays: Number(req.body.maxAgeDays || 0),
      targetFolderId: folderFilterFromBody(req.body.targetFolderId),
      tagFilter: Array.isArray(req.body.tagFilter)
        ? req.body.tagFilter.map((value: unknown) => String(value).trim()).filter(Boolean)
        : [],
      active: req.body.active !== false
    });

    return res.status(201).json({ id: String(rule._id) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create retention rule.";
    return res.status(400).json({ message });
  }
};

export const runRetentionRule = async (req: Request, res: Response) => {
  try {
    const affectedCount = await runRetentionRuleJob(getSingleParam(req.params.ruleId));
    return res.status(200).json({ affectedCount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run retention rule.";
    return res.status(400).json({ message });
  }
};
