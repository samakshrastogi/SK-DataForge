import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { env } from "../config/env";
import {
  FileCategory,
  TABLE_EXTENSIONS,
  TEXT_LIKE_EXTENSIONS,
  getFileCategory,
  isSupportedFileType
} from "../constants/uploads";
import { FolderModel } from "../models/Folder";
import { UploadedFileModel } from "../models/UploadedFile";
import {
  createNotification,
  evaluateQuotaNotifications,
  getStorageUsageBytes
} from "../services/notificationService";
import { getWorkspaceSettings } from "../services/workspaceService";
import { sanitizeFileName, sanitizeFolderName } from "../utils/uploadPaths";
import {
  computeFileHashFromBuffer,
  getTableRows,
  resolveAbsoluteFilePath
} from "../utils/fileIntelligence";

type RawCell = string | number | boolean | Date | null;

type InsightColumnProfile = {
  name: string;
  kind: "number" | "date" | "boolean" | "text";
  identifier: boolean;
  nonEmptyCount: number;
  emptyCount: number;
  uniqueCount: number;
  fillRate: number;
  topValues: Array<{ value: string; count: number }>;
  numeric?: {
    min: number;
    max: number;
    average: number;
    sum: number;
  };
  date?: {
    earliest: string;
    latest: string;
  };
  boolean?: {
    trueCount: number;
    falseCount: number;
  };
};

type InsightBlock =
  | {
      type: "metric_grid";
      title: string;
      metrics: Array<{ label: string; value: string }>;
    }
  | {
      type: "bar_list";
      title: string;
      subtitle?: string;
      valueFormat: "percent" | "number";
      items: Array<{ label: string; value: number }>;
    }
  | {
      type: "range_compare";
      title: string;
      subtitle?: string;
      items: Array<{ label: string; min: number; max: number; average: number }>;
    }
  | {
      type: "line_trend";
      title: string;
      subtitle?: string;
      valueFormat: "number";
      items: Array<{ label: string; value: number }>;
    };

type TablePreview = {
  kind: "table";
  columns: string[];
  rows: Array<{ id: string; values: string[] }>;
  insights: {
    summary: {
      rowCount: number;
      columnCount: number;
      populatedCellCount: number;
      missingCellCount: number;
      duplicateRowCount: number;
    };
    highlights: Array<{ title: string; detail: string }>;
    columns: InsightColumnProfile[];
    blocks: InsightBlock[];
  };
};

type GenericPreview =
  | TablePreview
  | {
      kind: "text";
      content: string;
      truncated: boolean;
      lineCount: number;
    }
  | {
      kind: "image";
      contentUrl: string;
    }
  | {
      kind: "pdf";
      contentUrl: string;
      pageCount: number;
    }
  | {
      kind: "media";
      mediaType: "audio" | "video";
      contentUrl: string;
    }
  | {
      kind: "archive";
      message: string;
    }
  | {
      kind: "document";
      contentUrl: string;
      message: string;
    }
  | {
      kind: "unsupported";
      message: string;
    };

const getUploadRootAbsolutePath = () => path.resolve(process.cwd(), env.uploadRoot);

const countPdfPages = async (absolutePath: string) => {
  try {
    const fileBuffer = await fs.readFile(absolutePath);
    const content = fileBuffer.toString("latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return matches?.length || 1;
  } catch {
    return 1;
  }
};

const isBlankValue = (value: RawCell | undefined) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const formatCellValue = (value: RawCell | undefined) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const tryParseNumber = (value: RawCell | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const tryParseDate = (value: RawCell | undefined) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const tryParseBoolean = (value: RawCell | undefined) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }

  return null;
};

const getTopValues = (values: string[], limit = 3) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;

const formatInsightDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);

const getDuplicateRowCount = (rows: string[][]) => {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = JSON.stringify(row);
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  return Array.from(seen.values()).reduce(
    (total, count) => total + (count > 1 ? count - 1 : 0),
    0
  );
};

const isLikelyIdentifierColumn = (name: string, uniqueCount: number, nonEmptyCount: number) => {
  const normalized = name.trim().toLowerCase();
  const idNamed =
    normalized === "id" ||
    normalized.endsWith("_id") ||
    normalized.endsWith(" id") ||
    normalized.includes("identifier") ||
    normalized.includes("code");

  return idNamed || (nonEmptyCount > 0 && uniqueCount / nonEmptyCount >= 0.95);
};

const toDayKey = (value: Date) => value.toISOString().slice(0, 10);

const toMonthKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const buildInsights = (columns: string[], rawRows: RawCell[][]): TablePreview["insights"] => {
  const rowCount = rawRows.length;
  const columnCount = columns.length;
  const displayRows = rawRows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => formatCellValue(row[index]))
  );
  const duplicateRowCount = getDuplicateRowCount(displayRows);

  const columnProfiles = columns.map<InsightColumnProfile>((column, columnIndex) => {
    const rawValues = rawRows.map((row) => row[columnIndex] ?? "");
    const nonEmptyValues = rawValues.filter((value) => !isBlankValue(value));
    const displayValues = nonEmptyValues.map((value) => formatCellValue(value));
    const uniqueCount = new Set(displayValues).size;
    const fillRate = rowCount === 0 ? 0 : (nonEmptyValues.length / rowCount) * 100;
    const numericValues = nonEmptyValues
      .map((value) => tryParseNumber(value))
      .filter((value): value is number => value !== null);
    const dateValues = nonEmptyValues
      .map((value) => tryParseDate(value))
      .filter((value): value is Date => value !== null);
    const booleanValues = nonEmptyValues
      .map((value) => tryParseBoolean(value))
      .filter((value): value is boolean => value !== null);

    const numericRatio = nonEmptyValues.length > 0 ? numericValues.length / nonEmptyValues.length : 0;
    const dateRatio = nonEmptyValues.length > 0 ? dateValues.length / nonEmptyValues.length : 0;
    const booleanRatio =
      nonEmptyValues.length > 0 ? booleanValues.length / nonEmptyValues.length : 0;

    let kind: InsightColumnProfile["kind"] = "text";
    if (numericRatio >= 0.8) {
      kind = "number";
    } else if (dateRatio >= 0.8) {
      kind = "date";
    } else if (booleanRatio >= 0.8) {
      kind = "boolean";
    }

    const profile: InsightColumnProfile = {
      name: column,
      kind,
      identifier: isLikelyIdentifierColumn(column, uniqueCount, nonEmptyValues.length),
      nonEmptyCount: nonEmptyValues.length,
      emptyCount: rowCount - nonEmptyValues.length,
      uniqueCount,
      fillRate,
      topValues: getTopValues(displayValues)
    };

    if (kind === "number" && numericValues.length > 0) {
      const sum = numericValues.reduce((total, value) => total + value, 0);
      profile.numeric = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        average: sum / numericValues.length,
        sum
      };
    }

    if (kind === "date" && dateValues.length > 0) {
      const timestamps = dateValues.map((value) => value.getTime());
      profile.date = {
        earliest: new Date(Math.min(...timestamps)).toISOString(),
        latest: new Date(Math.max(...timestamps)).toISOString()
      };
    }

    if (kind === "boolean" && booleanValues.length > 0) {
      const trueCount = booleanValues.filter(Boolean).length;
      profile.boolean = {
        trueCount,
        falseCount: booleanValues.length - trueCount
      };
    }

    return profile;
  });

  const populatedCellCount = columnProfiles.reduce(
    (total, profile) => total + profile.nonEmptyCount,
    0
  );
  const missingCellCount = rowCount * columnCount - populatedCellCount;
  const highlights: Array<{ title: string; detail: string }> = [];
  const blocks: InsightBlock[] = [];

  blocks.push({
    type: "metric_grid",
    title: "Dataset overview",
    metrics: [
      { label: "Rows", value: formatNumber(rowCount) },
      { label: "Columns", value: formatNumber(columnCount) },
      { label: "Filled cells", value: formatNumber(populatedCellCount) },
      { label: "Missing cells", value: formatNumber(missingCellCount) },
      { label: "Duplicate rows", value: formatNumber(duplicateRowCount) }
    ]
  });

  const completenessColumns = [...columnProfiles]
    .sort((left, right) => right.fillRate - left.fillRate)
    .slice(0, 8)
    .map((profile) => ({
      label: profile.name,
      value: Number(profile.fillRate.toFixed(1))
    }));

  if (completenessColumns.length > 0) {
    blocks.push({
      type: "bar_list",
      title: "Column completeness",
      subtitle: "Highest fill-rate columns",
      valueFormat: "percent",
      items: completenessColumns
    });
  }

  const numericColumns = columnProfiles.filter((profile) => profile.kind === "number" && profile.numeric);
  if (numericColumns.length > 0) {
    blocks.push({
      type: "range_compare",
      title: "Numeric comparisons",
      subtitle: "Range and average by numeric column",
      items: numericColumns.slice(0, 6).map((profile) => ({
        label: profile.name,
        min: profile.numeric!.min,
        max: profile.numeric!.max,
        average: profile.numeric!.average
      }))
    });
  }

  const categoricalColumns = columnProfiles.filter(
    (profile) =>
      profile.kind === "text" &&
      !profile.identifier &&
      profile.topValues.length > 0 &&
      profile.uniqueCount > 0 &&
      profile.uniqueCount <= Math.max(12, Math.floor(rowCount * 0.3))
  );
  const dominantCategory = [...categoricalColumns]
    .map((profile) => ({ profile, top: profile.topValues[0] }))
    .filter((item) => item.top)
    .sort((left, right) => right.top.count - left.top.count)[0];

  if (dominantCategory?.top) {
    blocks.push({
      type: "bar_list",
      title: `${dominantCategory.profile.name} distribution`,
      subtitle: "Most common categories",
      valueFormat: "number",
      items: dominantCategory.profile.topValues.slice(0, 6).map((item) => ({
        label: item.value,
        value: item.count
      }))
    });
  }

  const booleanColumn = columnProfiles.find((profile) => profile.kind === "boolean" && profile.boolean);
  if (booleanColumn?.boolean) {
    blocks.push({
      type: "bar_list",
      title: `${booleanColumn.name} breakdown`,
      subtitle: "Boolean split",
      valueFormat: "number",
      items: [
        { label: "True", value: booleanColumn.boolean.trueCount },
        { label: "False", value: booleanColumn.boolean.falseCount }
      ]
    });
  }

  const trendDateColumn = [...columnProfiles]
    .filter((profile) => profile.kind === "date" && profile.date)
    .sort((left, right) => right.nonEmptyCount - left.nonEmptyCount)[0];
  const trendNumericColumn = [...numericColumns].sort(
    (left, right) => right.nonEmptyCount - left.nonEmptyCount
  )[0];

  if (trendDateColumn && trendNumericColumn) {
    const dateIndex = columns.indexOf(trendDateColumn.name);
    const numericIndex = columns.indexOf(trendNumericColumn.name);
    const pairs = rawRows
      .map((row) => ({
        date: tryParseDate(row[dateIndex]),
        value: tryParseNumber(row[numericIndex])
      }))
      .filter(
        (item): item is { date: Date; value: number } => item.date !== null && item.value !== null
      );

    if (pairs.length >= 3) {
      const useMonthlyBuckets = new Set(pairs.map((item) => toDayKey(item.date))).size > 14;
      const grouped = new Map<string, number>();

      for (const pair of pairs) {
        const key = useMonthlyBuckets ? toMonthKey(pair.date) : toDayKey(pair.date);
        grouped.set(key, (grouped.get(key) || 0) + pair.value);
      }

      const items = Array.from(grouped.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .slice(-12)
        .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));

      if (items.length >= 3) {
        blocks.push({
          type: "line_trend",
          title: `${trendNumericColumn.name} over ${trendDateColumn.name}`,
          subtitle: useMonthlyBuckets ? "Monthly aggregate" : "Daily aggregate",
          valueFormat: "number",
          items
        });
      }
    }
  }

  highlights.push({
    title: "Dataset shape",
    detail: `${formatNumber(rowCount)} rows across ${formatNumber(columnCount)} columns.`
  });

  const mostComplete = [...columnProfiles].sort((left, right) => right.fillRate - left.fillRate)[0];
  if (mostComplete) {
    highlights.push({
      title: "Most complete column",
      detail: `${mostComplete.name} is filled in ${formatPercent(mostComplete.fillRate)} of rows.`
    });
  }

  const sparsestColumn = [...columnProfiles].sort((left, right) => left.fillRate - right.fillRate)[0];
  if (sparsestColumn && sparsestColumn.emptyCount > 0) {
    highlights.push({
      title: "Missing data hotspot",
      detail: `${sparsestColumn.name} has ${formatNumber(
        sparsestColumn.emptyCount
      )} empty cells, making it the sparsest column.`
    });
  }

  if (duplicateRowCount > 0) {
    highlights.push({
      title: "Duplicate rows detected",
      detail: `${formatNumber(duplicateRowCount)} repeated rows were found and may affect totals.`
    });
  }

  const strongestNumeric = [...numericColumns].sort(
    (left, right) =>
      (right.numeric!.max - right.numeric!.min) - (left.numeric!.max - left.numeric!.min)
  )[0];
  if (strongestNumeric?.numeric) {
    highlights.push({
      title: "Largest numeric spread",
      detail: `${strongestNumeric.name} ranges from ${formatNumber(
        strongestNumeric.numeric.min
      )} to ${formatNumber(strongestNumeric.numeric.max)}, with an average of ${formatNumber(
        strongestNumeric.numeric.average
      )}.`
    });
  }

  const widestDateRange = [...columnProfiles]
    .filter((profile) => profile.kind === "date" && profile.date)
    .sort((left, right) => {
      const leftSpan =
        new Date(left.date!.latest).getTime() - new Date(left.date!.earliest).getTime();
      const rightSpan =
        new Date(right.date!.latest).getTime() - new Date(right.date!.earliest).getTime();
      return rightSpan - leftSpan;
    })[0];

  if (widestDateRange?.date) {
    highlights.push({
      title: "Date coverage",
      detail: `${widestDateRange.name} spans from ${formatInsightDate(
        new Date(widestDateRange.date.earliest)
      )} to ${formatInsightDate(new Date(widestDateRange.date.latest))}.`
    });
  }

  return {
    summary: {
      rowCount,
      columnCount,
      populatedCellCount,
      missingCellCount,
      duplicateRowCount
    },
    highlights: highlights.slice(0, 6),
    columns: columnProfiles,
    blocks
  };
};

const buildTablePreview = (
  fileId: string,
  absolutePath: string
): TablePreview => {
  const workbook = XLSX.readFile(absolutePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      kind: "table",
      columns: [],
      rows: [],
      insights: {
        summary: {
          rowCount: 0,
          columnCount: 0,
          populatedCellCount: 0,
          missingCellCount: 0,
          duplicateRowCount: 0
        },
        highlights: [],
        columns: [],
        blocks: []
      }
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const table = XLSX.utils.sheet_to_json<RawCell[]>(sheet, {
    header: 1,
    defval: ""
  });

  if (table.length === 0) {
    return {
      kind: "table",
      columns: [],
      rows: [],
      insights: {
        summary: {
          rowCount: 0,
          columnCount: 0,
          populatedCellCount: 0,
          missingCellCount: 0,
          duplicateRowCount: 0
        },
        highlights: [],
        columns: [],
        blocks: []
      }
    };
  }

  const maxWidth = table.reduce((width, row) => Math.max(width, row.length), 0);
  const firstRow = table[0];
  const columns = Array.from({ length: maxWidth }, (_, index) => {
    const headerValue = firstRow[index];
    return headerValue ? String(headerValue) : `Column ${index + 1}`;
  });
  const dataRows = table.slice(1);

  return {
    kind: "table",
    columns,
    rows: dataRows.map((row, rowIndex) => ({
      id: `${fileId}-${rowIndex}`,
      values: Array.from({ length: maxWidth }, (_, columnIndex) =>
        formatCellValue(row[columnIndex])
      )
    })),
    insights: buildInsights(columns, dataRows)
  };
};

const buildTextPreview = async (absolutePath: string): Promise<GenericPreview> => {
  const textContent = await fs.readFile(absolutePath, "utf8");
  const maxLength = 16000;
  const truncated = textContent.length > maxLength;

  return {
    kind: "text",
    content: truncated ? `${textContent.slice(0, maxLength)}\n\n...truncated` : textContent,
    truncated,
    lineCount: textContent.split(/\r?\n/).length
  };
};

const buildPreviewForFile = async ({
  id,
  absolutePath,
  category,
  extension,
  contentUrl
}: {
  id: string;
  absolutePath: string;
  category: FileCategory | "unknown";
  extension: string;
  contentUrl: string;
}): Promise<GenericPreview> => {
  if (category === "table" && TABLE_EXTENSIONS.includes(extension)) {
    return buildTablePreview(id, absolutePath);
  }

  if (category === "text" || category === "code" || TEXT_LIKE_EXTENSIONS.includes(extension)) {
    return buildTextPreview(absolutePath);
  }

  if (category === "image") {
    return {
      kind: "image",
      contentUrl
    };
  }

  if (extension === ".pdf") {
    return {
      kind: "pdf",
      contentUrl,
      pageCount: await countPdfPages(absolutePath)
    };
  }

  if (category === "video" || category === "audio") {
    return {
      kind: "media",
      mediaType: category === "video" ? "video" : "audio",
      contentUrl
    };
  }

  if (category === "archive") {
    return {
      kind: "archive",
      message: "Archive preview currently shows metadata only. Open or download the file to inspect its contents."
    };
  }

  if (category === "document") {
    return {
      kind: "document",
      contentUrl,
      message:
        extension === ".pdf"
          ? "PDF preview available."
          : "This document type is uploaded successfully, but inline extraction is not enabled yet."
    };
  }

  return {
    kind: "unsupported",
    message: "This file type is stored successfully, but an inline preview is not available yet."
  };
};

const isSupportedFile = (file: Express.Multer.File) => {
  const extension = path.extname(file.originalname).toLowerCase();
  return isSupportedFileType(extension, file.mimetype);
};

const getRequestAuthToken = (req: Request) => {
  const header = req.header("authorization") || "";
  const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  return typeof req.query.token === "string" ? req.query.token : "";
};

export const getUploadFolders = async (_req: Request, res: Response) => {
  try {
    const folders = await FolderModel.find({}, { name: 1, _id: 0 }).sort({ name: 1 }).lean();
    return res.status(200).json({
      folders: folders.map((folder) => folder.name)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read folders.";
    return res.status(500).json({ message });
  }
};

export const uploadTableFiles = async (req: Request, res: Response) => {
  try {
    const folderName = sanitizeFolderName(String(req.body.folderName || ""));
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      await createNotification({
        type: "failed_upload",
        title: "Upload failed",
        message: "An upload was attempted without selecting any files.",
        metadata: { folderName }
      });
      return res.status(400).json({ message: "Select at least one file." });
    }

    const unsupportedFile = files.find((file) => !isSupportedFile(file));
    if (unsupportedFile) {
      await createNotification({
        type: "failed_upload",
        title: "Upload failed",
        message: `Unsupported file type for ${unsupportedFile.originalname}.`,
        metadata: { folderName, fileName: unsupportedFile.originalname }
      });
      return res.status(400).json({
        message: `Unsupported file type for ${unsupportedFile.originalname}.`
      });
    }

    const uploadRoot = getUploadRootAbsolutePath();
    const targetFolder = path.join(uploadRoot, folderName);
    await fs.mkdir(targetFolder, { recursive: true });

    const folder = await FolderModel.findOneAndUpdate(
      { name: folderName, parentId: null },
      { $setOnInsert: { name: folderName, parentId: null } },
      { new: true, upsert: true }
    );
    const [workspaceSettings, storageUsed, existingFiles] = await Promise.all([
      getWorkspaceSettings(),
      getStorageUsageBytes(),
      UploadedFileModel.find(
        { folderId: folder._id, lifecycleStatus: { $ne: "archived" } },
        { name: 1, size: 1, contentHash: 1 }
      ).lean<Array<{ name: string; size: number; contentHash: string }>>()
    ]);
    const existingFileMap = new Map(existingFiles.map((file) => [file.name, file]));
    const projectedIncrease = files.reduce((sum, file) => {
      const safeFileName = sanitizeFileName(file.originalname);
      const existing = existingFileMap.get(safeFileName);
      return sum + Math.max(file.size - (existing?.size || 0), 0);
    }, 0);

    if (storageUsed + projectedIncrease > workspaceSettings.quotaBytes) {
      await createNotification({
        type: "failed_upload",
        title: "Upload blocked by quota",
        message: `Upload to "${folderName}" was blocked because the workspace quota would be exceeded.`,
        metadata: {
          folderName,
          storageUsed,
          quotaBytes: workspaceSettings.quotaBytes,
          incomingBytes: projectedIncrease
        }
      });
      return res.status(400).json({
        message: "Upload exceeds the configured workspace quota."
      });
    }

    const savedFiles = await Promise.all(
      files.map(async (file) => {
        const safeFileName = sanitizeFileName(file.originalname);
        const extension = path.extname(safeFileName).toLowerCase();
        const category = getFileCategory(extension, file.mimetype);
        const filePath = path.join(targetFolder, safeFileName);
        const relativeFilePath = path.relative(process.cwd(), filePath);
        const contentHash = computeFileHashFromBuffer(file.buffer);
        const existingFile = existingFileMap.get(safeFileName);
        const duplicateMatches = await UploadedFileModel.countDocuments({
          contentHash,
          lifecycleStatus: { $ne: "archived" },
          name: { $ne: safeFileName }
        });

        await fs.writeFile(filePath, file.buffer);

        const savedFile = await UploadedFileModel.findOneAndUpdate(
          {
            folderId: folder._id,
            name: safeFileName
          },
          {
            folderId: folder._id,
            folderName,
            name: safeFileName,
            originalName: file.originalname,
            extension,
            category,
            size: file.size,
            type: file.mimetype,
            path: relativeFilePath,
            contentHash
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );

        if (existingFile) {
          await createNotification({
            type: "new_version_uploaded",
            title: "New version uploaded",
            message: `${safeFileName} was replaced with a newer upload in "${folderName}".`,
            metadata: {
              fileId: String(savedFile._id),
              fileName: safeFileName,
              folderName
            }
          });
        }

        if (duplicateMatches > 0) {
          await createNotification({
            type: "duplicate_detected",
            title: "Duplicate file detected",
            message: `${safeFileName} matches existing file content already stored in the workspace.`,
            metadata: {
              fileId: String(savedFile._id),
              fileName: safeFileName,
              folderName,
              duplicateMatches
            }
          });
        }

        return {
          id: String(savedFile._id),
          name: safeFileName,
          extension,
          category,
          size: file.size,
          type: file.mimetype,
          folder: folderName
        };
      })
    );

    await createNotification({
      type: "processing_completed",
      title: "Upload processing completed",
      message: `${savedFiles.length} file(s) finished processing in "${folderName}".`,
      metadata: {
        folderName,
        fileCount: savedFiles.length,
        fileIds: savedFiles.map((file) => file.id)
      }
    });
    await evaluateQuotaNotifications();

    return res.status(201).json({
      message: "Files uploaded successfully.",
      folderName,
      files: savedFiles
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed unexpectedly.";
    await createNotification({
      type: "failed_upload",
      title: "Upload failed",
      message,
      metadata: {
        folderName: String(req.body.folderName || "").trim()
      }
    });
    return res.status(400).json({ message });
  }
};

export const serveUploadedFileContent = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const uploadedFile = await UploadedFileModel.findById(fileId)
      .select({
        path: 1,
        type: 1,
        originalName: 1
      })
      .lean<{
        path: string;
        type: string;
        originalName: string;
      } | null>();

    if (!uploadedFile) {
      return res.status(404).json({ message: "Uploaded file not found." });
    }

    const absolutePath = resolveAbsoluteFilePath(uploadedFile.path);
    res.setHeader("Content-Type", uploadedFile.type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${uploadedFile.originalName}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read file content.";
    return res.status(400).json({ message });
  }
};

export const exportUploadedFileTable = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const format = String(req.query.format || "csv").toLowerCase();
    const uploadedFile = await UploadedFileModel.findById(fileId)
      .select({
        _id: 1,
        name: 1,
        path: 1,
        type: 1,
        extension: 1,
        category: 1
      })
      .lean<{
        _id: string;
        name: string;
        path: string;
        type: string;
        extension?: string;
        category?: FileCategory | "unknown";
      } | null>();

    if (!uploadedFile) {
      return res.status(404).json({ message: "Uploaded file not found." });
    }

    const extension = uploadedFile.extension || path.extname(uploadedFile.name).toLowerCase();
    const category = uploadedFile.category || getFileCategory(extension, uploadedFile.type);

    if (category !== "table") {
      return res.status(400).json({ message: "Only table files can be exported from the table preview." });
    }

    const absolutePath = resolveAbsoluteFilePath(uploadedFile.path);
    const { columns, rows } = getTableRows(absolutePath);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Preview");

    if (format === "xlsx") {
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${path.parse(uploadedFile.name).name}.xlsx"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.parse(uploadedFile.name).name}.csv"`
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export file.";
    return res.status(400).json({ message });
  }
};

export const getUploadedFilePreview = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const uploadedFile = await UploadedFileModel.findById(fileId)
      .select({
        _id: 1,
        name: 1,
        originalName: 1,
        folderName: 1,
        folderId: 1,
        path: 1,
        size: 1,
        type: 1,
        extension: 1,
        category: 1,
        updatedAt: 1
      })
      .lean<{
        _id: string;
        name: string;
        originalName: string;
        folderName: string;
        folderId: string;
        path: string;
        size: number;
        type: string;
        extension?: string;
        category?: FileCategory | "unknown";
        updatedAt: Date;
      } | null>();

    if (!uploadedFile) {
      return res.status(404).json({ message: "Uploaded file not found." });
    }

    const absolutePath = resolveAbsoluteFilePath(uploadedFile.path);
    const extension = uploadedFile.extension || path.extname(uploadedFile.name).toLowerCase();
    const category = uploadedFile.category || getFileCategory(extension, uploadedFile.type);
    const token = getRequestAuthToken(req);
    const contentUrl = `${env.appUrl}${env.apiBasePath}/uploads/files/${uploadedFile._id}/content${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`;
    const relatedFiles = await UploadedFileModel.find(
      { folderId: uploadedFile.folderId },
      {
        _id: 1,
        name: 1,
        category: 1,
        extension: 1,
        updatedAt: 1
      }
    )
      .sort({ updatedAt: -1, name: 1 })
      .lean<
        Array<{
          _id: string;
          name: string;
          category?: FileCategory | "unknown";
          extension?: string;
          updatedAt: Date;
        }>
      >();
    const preview = await buildPreviewForFile({
      id: String(uploadedFile._id),
      absolutePath,
      category,
      extension,
      contentUrl
    });

    return res.status(200).json({
      file: {
        id: String(uploadedFile._id),
        name: uploadedFile.name,
        originalName: uploadedFile.originalName,
        folderName: uploadedFile.folderName,
        size: uploadedFile.size,
        mimeType: uploadedFile.type,
        extension,
        category,
        updatedAt: uploadedFile.updatedAt,
        contentUrl
      },
      preview,
      relatedFiles: relatedFiles.map((item) => ({
        id: String(item._id),
        name: item.name,
        category: item.category || "unknown",
        extension: item.extension || path.extname(item.name).toLowerCase(),
        updatedAt: item.updatedAt
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview uploaded file.";
    return res.status(400).json({ message });
  }
};
