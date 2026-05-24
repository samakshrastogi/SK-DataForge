import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { clientEnv } from "../lib/env";

type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
};

type ManagerResponse = {
  currentFolder: {
    id: string;
    name: string;
    parentId: string | null;
  };
  breadcrumbs: Array<{
    id: string;
    name: string;
  }>;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    updatedAt: string;
    fileCount: number;
  }>;
  files: Array<{
    id: string;
    name: string;
    originalName: string;
    size: number;
    type: string;
    folderName: string;
    updatedAt: string;
    tags?: string[];
  }>;
  tree: FolderNode[];
  duplicateGroups: Array<{
    hash: string;
    count: number;
    size: number;
    wastedBytes: number;
    files: Array<{
      id: string;
      name: string;
      folderName: string;
      path: string;
      extension: string;
      updatedAt: string;
    }>;
  }>;
};

type AutomationResponse = {
  sources: Array<{
    id: string;
    name: string;
    provider: string;
    targetFolderId: string | null;
    sourceUrl: string;
    sourcePath: string;
    urlMode: string;
    scheduleMinutes: number;
    active: boolean;
    lastRunAt: string | null;
    lastImportedCount: number;
    lastError: string;
  }>;
  rules: Array<{
    id: string;
    name: string;
    action: "archive" | "delete";
    maxAgeDays: number;
    targetFolderId: string | null;
    tagFilter: string[];
    active: boolean;
    lastRunAt: string | null;
    lastAffectedCount: number;
    lastError: string;
  }>;
  folders: Array<{
    id: string;
    name: string;
  }>;
  providers: string[];
};

const ROOT_FOLDER_ID = "root";
const ROOT_FOLDER_NAME = "Home";

const primaryButtonClass =
  "rounded-xl border border-transparent bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] px-3 py-2 text-xs font-semibold text-white shadow-[0_14px_32px_rgba(99,102,241,0.24)] transition hover:-translate-y-0.5 hover:opacity-95";

type ManagerItem =
  | {
      kind: "folder";
      id: string;
      name: string;
      typeLabel: "Folder";
      sizeLabel: string;
      updatedAt: string;
      tags?: string[];
    }
  | {
      kind: "file";
      id: string;
      name: string;
      typeLabel: string;
      sizeLabel: string;
      updatedAt: string;
      tags?: string[];
    };

type BulkSelection = {
  folderIds: string[];
  fileIds: string[];
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getFileExtension(name: string, fallbackType: string) {
  const segments = name.split(".");
  const extension =
    segments.length > 1 ? segments[segments.length - 1]?.trim().toLowerCase() : "";

  if (extension) {
    return extension;
  }

  if (fallbackType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "xlsx";
  }

  if (fallbackType === "application/vnd.ms-excel") {
    return "xls";
  }

  if (fallbackType === "text/csv") {
    return "csv";
  }

  return "file";
}

type ManagerDialogState =
  | { kind: "closed" }
  | { kind: "create-folder"; value: string }
  | { kind: "rename-folder"; id: string; value: string; currentName: string }
  | { kind: "rename-file"; id: string; value: string; currentName: string }
  | { kind: "move-folder"; id: string; value: string; options: Array<{ id: string; name: string }> }
  | { kind: "copy-folder"; id: string; value: string; options: Array<{ id: string; name: string }> }
  | { kind: "move-file"; id: string; value: string; options: Array<{ id: string; name: string }> }
  | { kind: "copy-file"; id: string; value: string; options: Array<{ id: string; name: string }> }
  | { kind: "delete-folder"; id: string; name: string }
  | { kind: "delete-file"; id: string; name: string };

function ActionIcon({
  label,
  onClick,
  children,
  danger = false
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white ${
        danger
          ? "border-rose-200 bg-rose-50/70 text-rose-700 hover:border-rose-300 hover:bg-rose-50"
          : "border-white/80 bg-white/90 hover:border-sky-200 hover:text-sky-700"
      }`}
    >
      {children}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9V5h4" />
      <path d="M19 15v4h-4" />
      <path d="M5 5l6 6" />
      <path d="M19 19l-6-6" />
      <path d="M15 5h4v4" />
      <path d="M5 19h4v-4" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function flattenTree(nodes: FolderNode[], depth = 0): Array<{ id: string; name: string }> {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: `${"".padStart(depth * 2, " ")}${node.name}`
    },
    ...flattenTree(node.children, depth + 1)
  ]);
}

function TreeNode({
  node,
  currentFolderId,
  onOpen
}: {
  node: FolderNode;
  currentFolderId: string;
  onOpen: (folderId: string) => void;
}) {
  return (
    <li className="grid gap-1">
      <button
        type="button"
        onClick={() => onOpen(node.id)}
        className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
          currentFolderId === node.id
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        {node.name}
      </button>
      {node.children.length > 0 ? (
        <ul className="ml-3 grid gap-1 border-l border-slate-200 pl-2">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              currentFolderId={currentFolderId}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function FileManagerPage() {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [data, setData] = useState<ManagerResponse | null>(null);
  const [automationData, setAutomationData] = useState<AutomationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ManagerDialogState>({ kind: "closed" });
  const [selection, setSelection] = useState<BulkSelection>({ folderIds: [], fileIds: [] });
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [sourceForm, setSourceForm] = useState({
    name: "",
    provider: "url",
    targetFolderId: ROOT_FOLDER_ID,
    sourceUrl: "",
    sourcePath: "",
    urlMode: "single-file",
    scheduleMinutes: "0"
  });
  const [ruleForm, setRuleForm] = useState({
    name: "",
    action: "archive",
    maxAgeDays: "120",
    targetFolderId: ROOT_FOLDER_ID,
    tagFilter: ""
  });
  const currentFolderId = folderId || ROOT_FOLDER_ID;
  const isRootView = currentFolderId === ROOT_FOLDER_ID;

  const loadManager = async () => {
    try {
      setLoading(true);
      const endpoint =
        currentFolderId === ROOT_FOLDER_ID
          ? `${clientEnv.apiUrl}/manager`
          : `${clientEnv.apiUrl}/manager/folders/${currentFolderId}`;
      const response = await fetch(endpoint);
      const result = (await response.json()) as ManagerResponse | { message: string };

      if (!response.ok) {
        throw new Error((result as { message: string }).message);
      }

      setData(result as ManagerResponse);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load file manager."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadManager();
  }, [currentFolderId]);

  useEffect(() => {
    clearSelection();
  }, [currentFolderId]);

  useEffect(() => {
    const loadAutomation = async () => {
      try {
        const response = await fetch(`${clientEnv.apiUrl}/automation`);
        const result = (await response.json()) as AutomationResponse | { message: string };

        if (!response.ok) {
          throw new Error((result as { message: string }).message);
        }

        setAutomationData(result as AutomationResponse);
      } catch {
        setAutomationData(null);
      }
    };

    if (isRootView) {
      void loadAutomation();
    }
  }, [isRootView]);

  const destinationOptions = useMemo(() => {
    const folders = data ? flattenTree(data.tree) : [];
    return [{ id: ROOT_FOLDER_ID, name: ROOT_FOLDER_NAME }, ...folders];
  }, [data]);

  const managerItems = useMemo<ManagerItem[]>(() => {
    if (!data) {
      return [];
    }

    const folders = data.folders.map<ManagerItem>((folder) => ({
      kind: "folder",
      id: folder.id,
      name: folder.name,
      typeLabel: "Folder",
      sizeLabel: `${folder.fileCount} file${folder.fileCount === 1 ? "" : "s"}`,
      updatedAt: folder.updatedAt,
      tags: []
    }));

    const files = data.files.map<ManagerItem>((file) => ({
      kind: "file",
      id: file.id,
      name: file.name,
      typeLabel: getFileExtension(file.name, file.type),
      sizeLabel: formatFileSize(file.size),
      updatedAt: file.updatedAt,
      tags: file.tags || []
    }));

    return [...folders, ...files].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "folder" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [data]);

  const selectedCount = selection.folderIds.length + selection.fileIds.length;

  const openFolder = (id: string) => {
    if (id === ROOT_FOLDER_ID) {
      navigate("/manager");
      return;
    }

    navigate(`/manager/folders/${id}`);
  };

  const submitJson = async (url: string, method: string, body?: Record<string, string>) => {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    await loadManager();
  };

  const submitAnyJson = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  };

  const closeDialog = () => setDialog({ kind: "closed" });

  const toggleSelection = (item: ManagerItem, checked: boolean) => {
    setSelection((current) => ({
      folderIds:
        item.kind === "folder"
          ? checked
            ? Array.from(new Set([...current.folderIds, item.id]))
            : current.folderIds.filter((id) => id !== item.id)
          : current.folderIds,
      fileIds:
        item.kind === "file"
          ? checked
            ? Array.from(new Set([...current.fileIds, item.id]))
            : current.fileIds.filter((id) => id !== item.id)
          : current.fileIds
    }));
  };

  const clearSelection = () => {
    setSelection({ folderIds: [], fileIds: [] });
    setBulkTags("");
    setBulkTargetFolderId("");
  };

  const handleCreateFolder = () => {
    setDialog({ kind: "create-folder", value: "" });
  };

  const handleRenameFolder = (id: string, currentName: string) => {
    setDialog({ kind: "rename-folder", id, currentName, value: currentName });
  };

  const handleDeleteFolder = (id: string, name: string) => {
    setDialog({ kind: "delete-folder", id, name });
  };

  const handleMoveFolder = (id: string) => {
    setDialog({
      kind: "move-folder",
      id,
      value: "",
      options: destinationOptions.filter((option) => option.id !== id)
    });
  };

  const handleCopyFolder = (id: string) => {
    setDialog({
      kind: "copy-folder",
      id,
      value: "",
      options: destinationOptions.filter((option) => option.id !== id)
    });
  };

  const handleRenameFile = (id: string, currentName: string) => {
    setDialog({ kind: "rename-file", id, currentName, value: currentName });
  };

  const handleDeleteFile = (id: string, name: string) => {
    setDialog({ kind: "delete-file", id, name });
  };

  const handleMoveFile = (id: string) => {
    setDialog({
      kind: "move-file",
      id,
      value: "",
      options: destinationOptions.filter((option) => option.id !== ROOT_FOLDER_ID)
    });
  };

  const handleCopyFile = (id: string) => {
    setDialog({
      kind: "copy-file",
      id,
      value: "",
      options: destinationOptions.filter((option) => option.id !== ROOT_FOLDER_ID)
    });
  };

  const submitDialog = async () => {
    switch (dialog.kind) {
      case "create-folder":
        if (!dialog.value.trim()) return;
        await submitJson(`${clientEnv.apiUrl}/manager/folders`, "POST", {
          name: dialog.value.trim(),
          parentId: currentFolderId
        });
        break;
      case "rename-folder":
        if (!dialog.value.trim() || dialog.value.trim() === dialog.currentName) return;
        await submitJson(`${clientEnv.apiUrl}/manager/folders/${dialog.id}/rename`, "PATCH", {
          name: dialog.value.trim()
        });
        break;
      case "rename-file":
        if (!dialog.value.trim() || dialog.value.trim() === dialog.currentName) return;
        await submitJson(`${clientEnv.apiUrl}/manager/files/${dialog.id}/rename`, "PATCH", {
          name: dialog.value.trim()
        });
        break;
      case "move-folder":
        if (!dialog.value) return;
        await submitJson(`${clientEnv.apiUrl}/manager/folders/${dialog.id}/move`, "POST", {
          targetParentId: dialog.value
        });
        break;
      case "copy-folder":
        if (!dialog.value) return;
        await submitJson(`${clientEnv.apiUrl}/manager/folders/${dialog.id}/copy`, "POST", {
          targetParentId: dialog.value
        });
        break;
      case "move-file":
        if (!dialog.value) return;
        await submitJson(`${clientEnv.apiUrl}/manager/files/${dialog.id}/move`, "POST", {
          targetFolderId: dialog.value
        });
        break;
      case "copy-file":
        if (!dialog.value) return;
        await submitJson(`${clientEnv.apiUrl}/manager/files/${dialog.id}/copy`, "POST", {
          targetFolderId: dialog.value
        });
        break;
      case "delete-folder":
        await submitJson(`${clientEnv.apiUrl}/manager/folders/${dialog.id}`, "DELETE");
        break;
      case "delete-file":
        await submitJson(`${clientEnv.apiUrl}/manager/files/${dialog.id}`, "DELETE");
        break;
      default:
        return;
    }

    closeDialog();
  };

  const runBulkAction = async (
    endpoint: string,
    body?: Record<string, unknown>,
    fileName?: string
  ) => {
    if (!selectedCount) {
      return;
    }

    if (endpoint === "/manager/bulk/download" || endpoint === "/manager/bulk/export") {
      const response = await fetch(`${clientEnv.apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          folderIds: selection.folderIds,
          fileIds: selection.fileIds,
          ...(body || {})
        })
      });

      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Bulk request failed.");
      }

      const blob = await response.blob();
      downloadBlob(blob, fileName || "bundle.zip");
      return;
    }

    await submitAnyJson(`${clientEnv.apiUrl}${endpoint}`, "POST", {
      folderIds: selection.folderIds,
      fileIds: selection.fileIds,
      ...(body || {})
    });
    await loadManager();
    clearSelection();
  };

  const submitImportSource = async () => {
    await submitAnyJson(`${clientEnv.apiUrl}/automation/sources`, "POST", {
      name: sourceForm.name.trim(),
      provider: sourceForm.provider,
      targetFolderId: sourceForm.targetFolderId,
      sourceUrl: sourceForm.sourceUrl.trim(),
      sourcePath: sourceForm.sourcePath.trim(),
      urlMode: sourceForm.urlMode,
      scheduleMinutes: Number(sourceForm.scheduleMinutes || "0")
    });

    setSourceForm({
      name: "",
      provider: "url",
      targetFolderId: ROOT_FOLDER_ID,
      sourceUrl: "",
      sourcePath: "",
      urlMode: "single-file",
      scheduleMinutes: "0"
    });

    const response = await fetch(`${clientEnv.apiUrl}/automation`);
    setAutomationData((await response.json()) as AutomationResponse);
  };

  const submitRetentionRule = async () => {
    await submitAnyJson(`${clientEnv.apiUrl}/automation/rules`, "POST", {
      name: ruleForm.name.trim(),
      action: ruleForm.action,
      maxAgeDays: Number(ruleForm.maxAgeDays || "0"),
      targetFolderId: ruleForm.targetFolderId,
      tagFilter: ruleForm.tagFilter
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    });

    setRuleForm({
      name: "",
      action: "archive",
      maxAgeDays: "120",
      targetFolderId: ROOT_FOLDER_ID,
      tagFilter: ""
    });

    const response = await fetch(`${clientEnv.apiUrl}/automation`);
    setAutomationData((await response.json()) as AutomationResponse);
  };

  const runSourceNow = async (sourceId: string) => {
    await submitAnyJson(`${clientEnv.apiUrl}/automation/sources/${sourceId}/run`, "POST");
    const response = await fetch(`${clientEnv.apiUrl}/automation`);
    setAutomationData((await response.json()) as AutomationResponse);
    await loadManager();
  };

  const runRuleNow = async (ruleId: string) => {
    await submitAnyJson(`${clientEnv.apiUrl}/automation/rules/${ruleId}/run`, "POST");
    const response = await fetch(`${clientEnv.apiUrl}/automation`);
    setAutomationData((await response.json()) as AutomationResponse);
    await loadManager();
  };

  const dialogTitle =
    dialog.kind === "create-folder"
      ? "Create new folder"
      : dialog.kind === "rename-folder"
        ? "Rename folder"
        : dialog.kind === "rename-file"
          ? "Rename file"
          : dialog.kind === "move-folder"
            ? "Move folder"
            : dialog.kind === "copy-folder"
              ? "Copy folder"
              : dialog.kind === "move-file"
                ? "Move file"
                : dialog.kind === "copy-file"
                  ? "Copy file"
                  : dialog.kind === "delete-folder"
                    ? "Delete folder"
                    : dialog.kind === "delete-file"
                      ? "Delete file"
                      : "";

  return (
    <section className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-white/75 bg-white/78 p-4 shadow-[0_20px_60px_rgba(99,102,241,0.10)] backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              File Manager
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Browse folders</p>
          </div>
          <button
            type="button"
            onClick={() => openFolder(ROOT_FOLDER_ID)}
            className={primaryButtonClass}
          >
            Home
          </button>
        </div>

        <div className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
          {data ? (
            <ul className="grid gap-1">
              {data.tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  currentFolderId={currentFolderId}
                  onOpen={openFolder}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </aside>

      <div className="rounded-[28px] border border-white/75 bg-white/78 p-4 shadow-[0_20px_60px_rgba(99,102,241,0.10)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {data?.currentFolder.name || "File Manager"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {data?.breadcrumbs.map((crumb) => (
                <button
                  key={crumb.id}
                  type="button"
                  onClick={() => openFolder(crumb.id)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                >
                  {crumb.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateFolder}
              className={primaryButtonClass}
            >
              New folder
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-violet-50 px-3 py-2 text-sm text-slate-600">
            Loading file manager...
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <div className="mt-4">
            {selectedCount ? (
              <section className="mb-5 rounded-[24px] border border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.9),rgba(255,255,255,0.94),rgba(238,242,255,0.88))] p-4 shadow-[0_12px_30px_rgba(14,165,233,0.08)]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600">
                      Bulk Actions
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
                    </p>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-[180px_220px_auto_auto_auto_auto]">
                    <select
                      value={bulkTargetFolderId}
                      onChange={(event) => setBulkTargetFolderId(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                    >
                      <option value="">Move to...</option>
                      {destinationOptions
                        .filter((option) => option.id !== ROOT_FOLDER_ID)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={bulkTags}
                      onChange={(event) => setBulkTags(event.target.value)}
                      placeholder="tag1, tag2"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                    />
                    <button
                      type="button"
                      disabled={!bulkTargetFolderId}
                      onClick={() =>
                        void runBulkAction("/manager/bulk/move", {
                          targetFolderId: bulkTargetFolderId
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      disabled={!bulkTags.trim()}
                      onClick={() =>
                        void runBulkAction("/manager/bulk/tag", {
                          tags: bulkTags
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("/manager/bulk/export", {}, "manager-export.zip")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("/manager/bulk/download", {}, "manager-download.zip")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Download
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runBulkAction("/manager/bulk/delete")}
                    className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Delete selected
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Clear selection
                  </button>
                </div>
              </section>
            ) : null}

            {isRootView ? (
              <section className="mb-5 rounded-[24px] border border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94),rgba(254,249,195,0.82))] p-4 shadow-[0_16px_34px_rgba(245,158,11,0.08)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">
                      Duplicate Detection
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">
                      Same-content files across the workspace
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Files are grouped by content hash, so duplicates are detected by actual file contents, not by file name.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/90 bg-white/88 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Groups
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {data.duplicateGroups.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/90 bg-white/88 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Duplicate files
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {data.duplicateGroups.reduce((sum, group) => sum + group.count, 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/90 bg-white/88 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Recoverable
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatFileSize(
                          data.duplicateGroups.reduce((sum, group) => sum + group.wastedBytes, 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {data.duplicateGroups.length ? (
                    data.duplicateGroups.map((group) => (
                      <article
                        key={group.hash}
                        className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
                      >
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {group.count} copies of {formatFileSize(group.size)} each
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Potential space recovery: {formatFileSize(group.wastedBytes)}
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                            Hash {group.hash.slice(0, 12)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {group.files.map((file) => (
                            <Link
                              key={file.id}
                              to={`/files/${file.id}`}
                              className="grid gap-1 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3 text-sm transition hover:border-sky-200 hover:bg-white"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-slate-800">{file.name}</p>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                  {file.extension || "file"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">{file.path}</p>
                              <p className="text-xs text-slate-500">
                                Updated {formatModifiedDate(file.updatedAt)}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-amber-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
                      No duplicate files detected yet.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {isRootView && automationData ? (
              <section className="mb-5 grid gap-4 2xl:grid-cols-2">
                <article className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94),rgba(239,246,255,0.9))] p-4 shadow-[0_16px_34px_rgba(16,185,129,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                    Ingestion Center
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    Import from URL, scheduled folder sync, and connector-ready sources
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    URL and local-folder sync are active now. Cloud provider types are stored as first-class sources so connector execution can be expanded without changing the UI contract.
                  </p>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <input
                      type="text"
                      value={sourceForm.name}
                      onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })}
                      placeholder="Weekly vendor feed"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <select
                      value={sourceForm.provider}
                      onChange={(event) => setSourceForm({ ...sourceForm, provider: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      {automationData.providers.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sourceForm.targetFolderId}
                      onChange={(event) => setSourceForm({ ...sourceForm, targetFolderId: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      {automationData.folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={sourceForm.scheduleMinutes}
                      onChange={(event) => setSourceForm({ ...sourceForm, scheduleMinutes: event.target.value })}
                      placeholder="Schedule minutes"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <input
                      type="text"
                      value={sourceForm.sourceUrl}
                      onChange={(event) => setSourceForm({ ...sourceForm, sourceUrl: event.target.value })}
                      placeholder="https://example.com/feed.csv or manifest URL"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                    />
                    <input
                      type="text"
                      value={sourceForm.sourcePath}
                      onChange={(event) => setSourceForm({ ...sourceForm, sourcePath: event.target.value })}
                      placeholder="C:\\data\\watch-folder"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                    />
                    <select
                      value={sourceForm.urlMode}
                      onChange={(event) => setSourceForm({ ...sourceForm, urlMode: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="single-file">Single file URL</option>
                      <option value="manifest">Manifest URL</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void submitImportSource()}
                      className={primaryButtonClass}
                    >
                      Save source
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {automationData.sources.map((source) => (
                      <div key={source.id} className="rounded-2xl border border-white/90 bg-white/88 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{source.name}</p>
                            <p className="text-xs text-slate-500">
                              {source.provider} · every {source.scheduleMinutes || 0} min · imported {source.lastImportedCount}
                            </p>
                            {source.lastError ? (
                              <p className="mt-1 text-xs text-rose-600">{source.lastError}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => void runSourceNow(source.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Run now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[24px] border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(253,242,248,0.96),rgba(255,255,255,0.94),rgba(239,246,255,0.9))] p-4 shadow-[0_16px_34px_rgba(236,72,153,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-600">
                    Retention And Archiving
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    Lifecycle rules for ongoing storage hygiene
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Example policies: archive files older than 120 days or delete temporary uploads after 60 days.
                  </p>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <input
                      type="text"
                      value={ruleForm.name}
                      onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })}
                      placeholder="Archive stale reports"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <select
                      value={ruleForm.action}
                      onChange={(event) => setRuleForm({ ...ruleForm, action: event.target.value as "archive" | "delete" })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="archive">Archive</option>
                      <option value="delete">Delete</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={ruleForm.maxAgeDays}
                      onChange={(event) => setRuleForm({ ...ruleForm, maxAgeDays: event.target.value })}
                      placeholder="Max age days"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <select
                      value={ruleForm.targetFolderId}
                      onChange={(event) => setRuleForm({ ...ruleForm, targetFolderId: event.target.value })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      {automationData.folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={ruleForm.tagFilter}
                      onChange={(event) => setRuleForm({ ...ruleForm, tagFilter: event.target.value })}
                      placeholder="temp, transient"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                    />
                    <button
                      type="button"
                      onClick={() => void submitRetentionRule()}
                      className={primaryButtonClass}
                    >
                      Save rule
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {automationData.rules.map((rule) => (
                      <div key={rule.id} className="rounded-2xl border border-white/90 bg-white/88 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{rule.name}</p>
                            <p className="text-xs text-slate-500">
                              {rule.action} after {rule.maxAgeDays} days · affected {rule.lastAffectedCount}
                            </p>
                            {rule.tagFilter.length ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Tags: {rule.tagFilter.join(", ")}
                              </p>
                            ) : null}
                            {rule.lastError ? (
                              <p className="mt-1 text-xs text-rose-600">{rule.lastError}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => void runRuleNow(rule.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Run now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            ) : null}

            {managerItems.length > 0 ? (
              <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/92 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[linear-gradient(90deg,rgba(14,165,233,0.08),rgba(139,92,246,0.10),rgba(236,72,153,0.08))]">
                      <tr>
                        <th className="px-3 py-2 font-medium text-slate-600">Select</th>
                        <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                        <th className="px-3 py-2 font-medium text-slate-600">
                          Date modified
                        </th>
                        <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                        <th className="px-3 py-2 font-medium text-slate-600">Size</th>
                        <th className="px-3 py-2 font-medium text-slate-600">Tags</th>
                        <th className="px-3 py-2 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managerItems.map((item) => (
                        <tr key={`${item.kind}-${item.id}`} className="border-t border-slate-100/90 align-middle transition hover:bg-sky-50/45">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={
                                item.kind === "folder"
                                  ? selection.folderIds.includes(item.id)
                                  : selection.fileIds.includes(item.id)
                              }
                              onChange={(event) => toggleSelection(item, event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {item.kind === "folder" ? (
                              <button
                                type="button"
                                onClick={() => openFolder(item.id)}
                                className="font-medium text-slate-800 hover:text-sky-700"
                              >
                                {item.name}
                              </button>
                            ) : (
                              <Link
                                to={`/files/${item.id}`}
                                className="font-medium text-slate-800 hover:text-sky-700"
                              >
                                {item.name}
                              </Link>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {formatModifiedDate(item.updatedAt)}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {item.typeLabel}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {item.sizeLabel}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            <div className="flex flex-wrap gap-1">
                              {(item.tags || []).length ? (
                                (item.tags || []).map((tag) => (
                                  <span
                                    key={`${item.id}-${tag}`}
                                    className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <ActionIcon
                                label="Copy"
                                onClick={() =>
                                  void (item.kind === "folder"
                                    ? handleCopyFolder(item.id)
                                    : handleCopyFile(item.id))
                                }
                              >
                                <CopyIcon />
                              </ActionIcon>
                              <ActionIcon
                                label="Move"
                                onClick={() =>
                                  void (item.kind === "folder"
                                    ? handleMoveFolder(item.id)
                                    : handleMoveFile(item.id))
                                }
                              >
                                <MoveIcon />
                              </ActionIcon>
                              <ActionIcon
                                label="Rename"
                                onClick={() =>
                                  void (item.kind === "folder"
                                    ? handleRenameFolder(item.id, item.name)
                                    : handleRenameFile(item.id, item.name))
                                }
                              >
                                <RenameIcon />
                              </ActionIcon>
                              <ActionIcon
                                label="Delete"
                                danger
                                onClick={() =>
                                  void (item.kind === "folder"
                                    ? handleDeleteFolder(item.id, item.name)
                                    : handleDeleteFile(item.id, item.name))
                                }
                              >
                                <DeleteIcon />
                              </ActionIcon>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.9),rgba(245,243,255,0.9))] px-3 py-4 text-sm text-slate-500">
                No files or folders inside this location yet.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {dialog.kind !== "closed" ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">File Manager</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{dialogTitle}</h2>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-xl border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white"
              >
                Close
              </button>
            </div>

            {dialog.kind === "create-folder" || dialog.kind === "rename-folder" || dialog.kind === "rename-file" ? (
              <div className="mt-4 grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  {dialog.kind === "create-folder" ? "Folder name" : "Name"}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={dialog.value}
                  onChange={(event) => setDialog({ ...dialog, value: event.target.value })}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  placeholder={dialog.kind === "create-folder" ? "Enter folder name" : "Enter new name"}
                />
              </div>
            ) : null}

            {dialog.kind === "move-folder" ||
            dialog.kind === "copy-folder" ||
            dialog.kind === "move-file" ||
            dialog.kind === "copy-file" ? (
              <div className="mt-4 grid gap-2">
                <label className="text-sm font-medium text-slate-700">Choose destination folder</label>
                <select
                  autoFocus
                  value={dialog.value}
                  onChange={(event) => setDialog({ ...dialog, value: event.target.value })}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">Select a folder</option>
                  {dialog.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {dialog.kind === "delete-folder" || dialog.kind === "delete-file" ? (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {dialog.kind === "delete-folder"
                  ? `Delete "${dialog.name}" and everything inside it?`
                  : `Delete "${dialog.name}"?`}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitDialog()}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 ${
                  dialog.kind === "delete-folder" || dialog.kind === "delete-file"
                    ? "bg-rose-500"
                    : "bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)]"
                }`}
              >
                {dialog.kind === "delete-folder" || dialog.kind === "delete-file" ? "Delete" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
