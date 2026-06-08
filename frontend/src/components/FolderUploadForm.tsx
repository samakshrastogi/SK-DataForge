import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clientEnv } from "../lib/env";

const ACCEPTED_FILE_TYPES =
  ".csv,.tsv,.xls,.xlsx,.ods,.pdf,.txt,.md,.json,.xml,.log,.js,.ts,.jsx,.tsx,.py,.css,.html,.yml,.yaml,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.zip,.rar,.7z,.tar,.gz,.doc,.docx,.rtf";

type UploadResponse = {
  message: string;
  folderName: string;
  files: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    folder: string;
  }>;
};

const CREATE_NEW_FOLDER = "__create_new__";

export default function FolderUploadForm() {
  const navigate = useNavigate();
  const [folderName, setFolderName] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolderOption, setSelectedFolderOption] =
    useState(CREATE_NEW_FOLDER);
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadResponse["files"]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const response = await fetch(`${clientEnv.apiUrl}/uploads/folders`);

        if (!response.ok) {
          throw new Error("Failed to load folders.");
        }

        const data = (await response.json()) as { folders: string[] };
        setFolders(data.folders);

        if (data.folders.length > 0) {
          setSelectedFolderOption(data.folders[0]);
        }
      } catch {
        setFolders([]);
      }
    };

    void loadFolders();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedFolderName =
      selectedFolderOption === CREATE_NEW_FOLDER
        ? folderName.trim()
        : selectedFolderOption;

    if (!selectedFolderName) {
      setStatus("Enter a folder name.");
      return;
    }

    if (!files || files.length === 0) {
      setStatus("Select at least one file.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Uploading files...");

    try {
      const formData = new FormData();
      formData.append("folderName", selectedFolderName);

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${clientEnv.apiUrl}/uploads`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as UploadResponse | { message: string };

      if (!response.ok) {
        throw new Error(data.message);
      }

      const uploadData = data as UploadResponse;

      setUploaded(uploadData.files);
      setFolders((current) => {
        const nextFolders = current.includes(uploadData.folderName)
          ? current
          : [...current, uploadData.folderName].sort((left, right) =>
              left.localeCompare(right)
            );

        setSelectedFolderOption(uploadData.folderName);
        return nextFolders;
      });
      setStatus(
        `Saved ${uploadData.files.length} file(s) in folder "${uploadData.folderName}".`
      );
      setFolderName("");
      setFiles(null);

      const fileInput = document.getElementById("table-files") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      setStatus(message);
      setUploaded([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/75 bg-white/90 p-4 shadow-[0_16px_44px_rgba(31,41,55,0.08)] backdrop-blur">
      <form className="grid gap-4 lg:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)_auto] lg:items-end" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Folder</span>
          <select
            value={selectedFolderOption}
            onChange={(event) => setSelectedFolderOption(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          >
            <option value={CREATE_NEW_FOLDER}>Create new folder</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
          {selectedFolderOption === CREATE_NEW_FOLDER ? (
            <input
              type="text"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="sales-q2-2026"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          ) : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Files</span>
          <input
            id="table-files"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={(event) => setFiles(event.target.files)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl bg-[linear-gradient(90deg,#0ea5e9,#6366f1,#ec4899)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Uploading..." : "Upload"}
        </button>
      </form>

      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}

      {uploaded.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {uploaded.map((file) => (
                <tr key={`${file.folder}-${file.name}`} className="border-t border-slate-100">
                  <td className="break-all px-3 py-2 font-mono text-xs text-slate-700">{file.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{Math.ceil(file.size / 1024)} KB</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/files/${file.id}`)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-200"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
