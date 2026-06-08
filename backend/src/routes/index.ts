import { Router } from "express";
import multer from "multer";
import { getAuditLogs } from "../controllers/auditController";
import { createUser, getCurrentUser, listUsers, login } from "../controllers/authController";
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
import { auditMutations } from "../middleware/auditMiddleware";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/health", getHealth);
router.post("/auth/login", login);

router.use(requireAuth);
router.use(auditMutations);

router.get("/auth/me", getCurrentUser);
router.get("/auth/users", requireRole("admin"), listUsers);
router.post("/auth/users", requireRole("admin"), createUser);
router.get("/audit", requireRole("admin"), getAuditLogs);
router.get("/dashboard", getDashboardSummary);
router.get("/notifications", getNotifications);
router.post("/notifications/read-all", markAllNotificationsRead);
router.get("/workspace", getWorkspaceSettingsSummary);
router.patch("/workspace", requireRole("admin"), updateWorkspaceSettings);
router.get("/automation", getAutomationOverview);
router.post("/automation/sources", requireRole("editor"), createImportSource);
router.post("/automation/sources/:sourceId/run", requireRole("editor"), runImportSource);
router.post("/automation/rules", requireRole("editor"), createRetentionRule);
router.post("/automation/rules/:ruleId/run", requireRole("editor"), runRetentionRule);
router.get("/uploads/folders", getUploadFolders);
router.get("/uploads/files/:fileId/content", serveUploadedFileContent);
router.get("/uploads/files/:fileId/export", exportUploadedFileTable);
router.get("/uploads/files/:fileId/preview", getUploadedFilePreview);
router.post("/uploads", requireRole("editor"), upload.array("files"), uploadTableFiles);
router.get("/search", getGlobalSearchResults);
router.get("/manager", getManagerRoot);
router.get("/manager/duplicates", getDuplicateFiles);
router.post("/manager/bulk/move", requireRole("editor"), bulkMoveItems);
router.post("/manager/bulk/delete", requireRole("editor"), bulkDeleteItems);
router.post("/manager/bulk/tag", requireRole("editor"), bulkTagItems);
router.post("/manager/bulk/download", bulkDownloadItems);
router.post("/manager/bulk/export", bulkExportItems);
router.get("/manager/folders/:folderId", getManagerFolderContents);
router.post("/manager/folders", requireRole("editor"), createFolder);
router.patch("/manager/folders/:folderId/rename", requireRole("editor"), renameFolder);
router.delete("/manager/folders/:folderId", requireRole("editor"), deleteFolder);
router.post("/manager/folders/:folderId/move", requireRole("editor"), moveFolder);
router.post("/manager/folders/:folderId/copy", requireRole("editor"), copyFolder);
router.patch("/manager/files/:fileId/rename", requireRole("editor"), renameFile);
router.delete("/manager/files/:fileId", requireRole("editor"), deleteFile);
router.post("/manager/files/:fileId/move", requireRole("editor"), moveFile);
router.post("/manager/files/:fileId/copy", requireRole("editor"), copyFile);

export default router;
