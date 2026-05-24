import { Router } from "express";
import multer from "multer";
import {
  createImportSource,
  createRetentionRule,
  getAutomationOverview,
  runImportSource,
  runRetentionRule
} from "../controllers/automationController";
import { getDashboardSummary } from "../controllers/dashboardController";
import {
  bulkDeleteItems,
  bulkDownloadItems,
  bulkExportItems,
  bulkMoveItems,
  bulkTagItems,
  copyFile,
  copyFolder,
  createFolder,
  deleteFile,
  deleteFolder,
  getDuplicateFiles,
  getGlobalSearchResults,
  getManagerFolderContents,
  getManagerRoot,
  moveFile,
  moveFolder,
  renameFile,
  renameFolder
} from "../controllers/fileManagerController";
import { getHealth } from "../controllers/healthController";
import {
  getNotifications,
  markAllNotificationsRead
} from "../controllers/notificationController";
import {
  exportUploadedFileTable,
  getUploadedFilePreview,
  getUploadFolders,
  serveUploadedFileContent,
  uploadTableFiles
} from "../controllers/uploadController";
import {
  getWorkspaceSettingsSummary,
  updateWorkspaceSettings
} from "../controllers/workspaceController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/dashboard", getDashboardSummary);
router.get("/health", getHealth);
router.get("/notifications", getNotifications);
router.post("/notifications/read-all", markAllNotificationsRead);
router.get("/workspace", getWorkspaceSettingsSummary);
router.patch("/workspace", updateWorkspaceSettings);
router.get("/automation", getAutomationOverview);
router.post("/automation/sources", createImportSource);
router.post("/automation/sources/:sourceId/run", runImportSource);
router.post("/automation/rules", createRetentionRule);
router.post("/automation/rules/:ruleId/run", runRetentionRule);
router.get("/uploads/folders", getUploadFolders);
router.get("/uploads/files/:fileId/content", serveUploadedFileContent);
router.get("/uploads/files/:fileId/export", exportUploadedFileTable);
router.get("/uploads/files/:fileId/preview", getUploadedFilePreview);
router.post("/uploads", upload.array("files"), uploadTableFiles);
router.get("/search", getGlobalSearchResults);
router.get("/manager", getManagerRoot);
router.get("/manager/duplicates", getDuplicateFiles);
router.post("/manager/bulk/move", bulkMoveItems);
router.post("/manager/bulk/delete", bulkDeleteItems);
router.post("/manager/bulk/tag", bulkTagItems);
router.post("/manager/bulk/download", bulkDownloadItems);
router.post("/manager/bulk/export", bulkExportItems);
router.get("/manager/folders/:folderId", getManagerFolderContents);
router.post("/manager/folders", createFolder);
router.patch("/manager/folders/:folderId/rename", renameFolder);
router.delete("/manager/folders/:folderId", deleteFolder);
router.post("/manager/folders/:folderId/move", moveFolder);
router.post("/manager/folders/:folderId/copy", copyFolder);
router.patch("/manager/files/:fileId/rename", renameFile);
router.delete("/manager/files/:fileId", deleteFile);
router.post("/manager/files/:fileId/move", moveFile);
router.post("/manager/files/:fileId/copy", copyFile);

export default router;
