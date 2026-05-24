import path from "path";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { FolderModel } from "../models/Folder";
import { UploadedFileModel } from "../models/UploadedFile";
import { getWorkspaceSettings } from "../services/workspaceService";

const TABLE_CATEGORIES = new Set(["table"]);
const DOCUMENT_CATEGORIES = new Set(["document"]);
const TRACKED_FILE_TYPES = ["pdf", "csv", "json", "log", "xlsx", "txt"] as const;
const ACTIVE_FILE_FILTER = { lifecycleStatus: { $ne: "archived" } };

function normalizeExtension(extension: string | null | undefined) {
  return (extension || "").trim().toLowerCase().replace(/^\./, "");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const next = new Date(date);
  next.setDate(date.getDate() - diff);
  return startOfDay(next);
}

function formatHourRange(hour: number) {
  const startHour = hour % 24;
  const endHour = (hour + 1) % 24;
  const formatLabel = (value: number) => {
    const suffix = value >= 12 ? "PM" : "AM";
    const normalized = value % 12 || 12;
    return `${normalized} ${suffix}`;
  };
  return `${formatLabel(startHour)} - ${formatLabel(endHour)}`;
}

export const getDashboardSummary = async (_req: Request, res: Response) => {
  try {
    const [folderCount, fileCount, folders, files, workspaceSettings] = await Promise.all([
      FolderModel.countDocuments(),
      UploadedFileModel.countDocuments(ACTIVE_FILE_FILTER),
      FolderModel.find({}, { name: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).lean<Array<{
        _id: Types.ObjectId;
        name: string;
        updatedAt: Date;
      }>>(),
      UploadedFileModel.find(
        ACTIVE_FILE_FILTER,
        { name: 1, originalName: 1, folderId: 1, folderName: 1, category: 1, extension: 1, size: 1, createdAt: 1, updatedAt: 1 }
      )
        .sort({ updatedAt: -1 })
        .lean<Array<{
          _id: Types.ObjectId;
          folderId: Types.ObjectId;
          folderName: string;
          name: string;
          originalName?: string;
          category: string;
          extension: string;
          size: number;
          createdAt?: Date;
          updatedAt: Date;
        }>>(),
      getWorkspaceSettings()
    ]);

    const now = Date.now();
    const today = new Date();
    const todayStart = startOfDay(today);
    const weekStart = startOfWeek(today);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(weekStart.getDate() - 7);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let storageUsed = 0;
    let recentUploads = 0;
    let tableFiles = 0;
    let documentFiles = 0;
    let uploadsToday = 0;
    let uploadsThisWeek = 0;
    let uploadsThisMonth = 0;
    let storageAddedThisWeek = 0;
    let storageAddedPreviousWeek = 0;
    const fileCountByFolder = new Map<string, number>();
    const storageByFolder = new Map<string, number>();
    const fileTypeCounts = new Map<(typeof TRACKED_FILE_TYPES)[number], number>(
      TRACKED_FILE_TYPES.map((type) => [type, 0])
    );
    const uploadsByHour = Array.from({ length: 24 }, () => 0);
    const uploadsByDay = new Map<string, number>();

    for (const file of files) {
      storageUsed += file.size;
      const uploadedAt = new Date(file.createdAt || file.updatedAt);
      const uploadedTime = uploadedAt.getTime();

      if (uploadedTime >= sevenDaysAgo) {
        recentUploads += 1;
      }

      if (uploadedAt >= todayStart) {
        uploadsToday += 1;
      }

      if (uploadedAt >= weekStart) {
        uploadsThisWeek += 1;
        storageAddedThisWeek += file.size;
      } else if (uploadedAt >= previousWeekStart && uploadedAt < weekStart) {
        storageAddedPreviousWeek += file.size;
      }

      if (uploadedAt >= monthStart) {
        uploadsThisMonth += 1;
      }

      if (TABLE_CATEGORIES.has(file.category)) {
        tableFiles += 1;
      }

      if (DOCUMENT_CATEGORIES.has(file.category)) {
        documentFiles += 1;
      }

      const folderKey = String(file.folderId);
      fileCountByFolder.set(folderKey, (fileCountByFolder.get(folderKey) || 0) + 1);
      storageByFolder.set(folderKey, (storageByFolder.get(folderKey) || 0) + file.size);
      uploadsByHour[uploadedAt.getHours()] += 1;
      const dayKey = startOfDay(uploadedAt).toISOString();
      uploadsByDay.set(dayKey, (uploadsByDay.get(dayKey) || 0) + 1);

      const normalizedExtension = normalizeExtension(
        file.extension || path.extname(file.originalName || file.name)
      );
      if (TRACKED_FILE_TYPES.includes(normalizedExtension as (typeof TRACKED_FILE_TYPES)[number])) {
        const extensionKey = normalizedExtension as (typeof TRACKED_FILE_TYPES)[number];
        fileTypeCounts.set(extensionKey, (fileTypeCounts.get(extensionKey) || 0) + 1);
      }
    }

    const recentFiles = files.slice(0, 6).map((file) => ({
      id: String(file._id),
      name: file.name,
      folderId: String(file.folderId),
      folderName: file.folderName,
      category: file.category,
      extension: file.extension,
      size: file.size,
      updatedAt: file.updatedAt
    }));

    const recentFolders = folders.slice(0, 6).map((folder) => ({
      id: String(folder._id),
      name: folder.name,
      updatedAt: folder.updatedAt,
      fileCount: fileCountByFolder.get(String(folder._id)) || 0,
      storageUsed: storageByFolder.get(String(folder._id)) || 0
    }));

    const mostActiveFolder = recentFolders
      .slice()
      .sort((left, right) => right.fileCount - left.fileCount)[0] || null;

    const biggestDataset = files
      .filter((file) => TABLE_CATEGORIES.has(file.category))
      .slice()
      .sort((left, right) => right.size - left.size)[0] || null;

    const recentInsightsReadyFiles = files
      .filter((file) => TABLE_CATEGORIES.has(file.category))
      .slice(0, 4)
      .map((file) => ({
        id: String(file._id),
        name: file.name,
        folderName: file.folderName,
        size: file.size,
        updatedAt: file.updatedAt
      }));

    const filesNeedingReview = files
      .filter((file) => !TABLE_CATEGORIES.has(file.category))
      .slice(0, 4)
      .map((file) => ({
        id: String(file._id),
        name: file.name,
        category: file.category,
        folderName: file.folderName,
        updatedAt: file.updatedAt
      }));

    const peakUploadHour = uploadsByHour.reduce(
      (best, count, hour) => (count > best.count ? { hour, count } : best),
      { hour: 0, count: 0 }
    );

    const averageUploadsPerDay = uploadsByDay.size
      ? Number((fileCount / uploadsByDay.size).toFixed(1))
      : 0;

    const storageByFolderRows = folders
      .map((folder) => ({
        id: String(folder._id),
        name: folder.name,
        storageUsed: storageByFolder.get(String(folder._id)) || 0,
        fileCount: fileCountByFolder.get(String(folder._id)) || 0
      }))
      .filter((folder) => folder.storageUsed > 0)
      .sort((left, right) => right.storageUsed - left.storageUsed);

    const topFoldersByStorage = storageByFolderRows.slice(0, 4).map((folder) => ({
      ...folder,
      percentage: storageUsed ? Math.round((folder.storageUsed / storageUsed) * 100) : 0
    }));

    const largestFiles = files
      .slice()
      .sort((left, right) => right.size - left.size)
      .slice(0, 4)
      .map((file) => ({
        id: String(file._id),
        name: file.name,
        folderName: file.folderName,
        extension: file.extension,
        size: file.size
      }));

    const storageGrowthRate = storageAddedPreviousWeek
      ? Math.round(((storageAddedThisWeek - storageAddedPreviousWeek) / storageAddedPreviousWeek) * 100)
      : storageAddedThisWeek > 0
        ? 100
        : 0;
    const totalCapacity = workspaceSettings.quotaBytes;

    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart);
      date.setDate(todayStart.getDate() - (6 - index));
      const key = date.toISOString();
      return {
        date: key,
        label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        count: uploadsByDay.get(key) || 0
      };
    });

    return res.status(200).json({
      stats: {
        totalFolders: folderCount,
        totalFiles: fileCount,
        recentUploads,
        tableFiles,
        documentFiles,
        storageUsed
      },
      fileTypeAnalytics: TRACKED_FILE_TYPES.map((type) => ({
        extension: type,
        count: fileTypeCounts.get(type) || 0,
        percentage: fileCount ? Math.round(((fileTypeCounts.get(type) || 0) / fileCount) * 100) : 0
      })),
      uploadTrend: {
        uploadedToday: uploadsToday,
        uploadedThisWeek: uploadsThisWeek,
        uploadedThisMonth: uploadsThisMonth,
        peakUploadHour: peakUploadHour.hour,
        peakUploadHourLabel: formatHourRange(peakUploadHour.hour),
        averageUploadsPerDay,
        dailySeries: trendDays
      },
      storageBreakdown: {
        totalCapacity,
        remainingCapacity: Math.max(totalCapacity - storageUsed, 0),
        usedPercentage: Math.min(Math.round((storageUsed / Math.max(totalCapacity, 1)) * 100), 100),
        growthRateThisWeek: storageGrowthRate,
        warningThresholds: workspaceSettings.warningThresholds,
        workspaceName: workspaceSettings.name,
        topFolders: topFoldersByStorage,
        largestFiles
      },
      recentFiles,
      recentFolders,
      insights: {
        mostActiveFolder: mostActiveFolder
          ? {
              id: mostActiveFolder.id,
              name: mostActiveFolder.name,
              fileCount: mostActiveFolder.fileCount,
              storageUsed: mostActiveFolder.storageUsed
            }
          : null,
        biggestDataset: biggestDataset
          ? {
              id: String(biggestDataset._id),
              name: biggestDataset.name,
              folderName: biggestDataset.folderName,
              size: biggestDataset.size
            }
          : null,
        recentInsightsReadyFiles,
        filesNeedingReview
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard.";
    return res.status(500).json({ message });
  }
};
