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

const supportedFormats = ["Tables", "Docs", "Images", "Media", "Archives"];
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
    <section className="overflow-hidden rounded-[36px] border border-white/75 bg-white/85 shadow-[0_24px_80px_rgba(31,41,55,0.10)] backdrop-blur">
      <div className="grid gap-0 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(251,113,133,0.16),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(255,255,255,0.88))] p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            File Intake
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            Create a folder and upload mixed file types into one workspace.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
            The interface accepts tables, documents, images, media, archives,
            and code/text files, creates the folder automatically, and stores
            the uploads inside that folder on the backend.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {supportedFormats.map((format, index) => (
              <span
                key={format}
                className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${
                  index % 5 === 0
                    ? "bg-amber-100 text-amber-700"
                    : index % 5 === 1
                      ? "bg-sky-100 text-sky-700"
                      : index % 5 === 2
                        ? "bg-emerald-100 text-emerald-700"
                        : index % 5 === 3
                          ? "bg-fuchsia-100 text-fuchsia-700"
                          : "bg-rose-100 text-rose-700"
                }`}
              >
                {format}
              </span>
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
              <p className="text-sm font-medium text-slate-500">Experience</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">
                Bright, responsive, full-width layout
              </p>
            </div>
            <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <p className="text-sm font-medium text-slate-500">Behavior</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">
                Folder-first upload organization
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.98))] p-6 sm:p-8 lg:p-10">
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Folder
              </span>
              <select
                value={selectedFolderOption}
                onChange={(event) => setSelectedFolderOption(event.target.value)}
                className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition duration-300 placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
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
                  className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition duration-300 placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              ) : null}
              <p className="text-sm leading-6 text-slate-500">
                {selectedFolderOption === CREATE_NEW_FOLDER
                  ? "Choose create new folder, then enter the folder name below."
                  : "Selected files will be uploaded into the chosen existing folder."}
              </p>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Files
              </span>
              <input
                id="table-files"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                multiple
                onChange={(event) => setFiles(event.target.files)}
                className="rounded-[24px] border-2 border-dashed border-sky-200 bg-gradient-to-br from-sky-50 via-white to-rose-50 px-4 py-8 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-gradient-to-r file:from-sky-500 file:to-violet-500 file:px-5 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[linear-gradient(90deg,#0ea5e9,#8b5cf6,#f43f5e)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(99,102,241,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(99,102,241,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Uploading..." : "Create Folder and Upload"}
              </button>

              {status ? (
                <p className="text-sm leading-7 text-slate-600">{status}</p>
              ) : (
                <p className="text-sm leading-7 text-slate-500">
                  Files are stored in the backend upload directory under the
                  folder name you enter or select.
                </p>
              )}
            </div>
          </form>

          {uploaded.length > 0 ? (
            <div className="mt-8 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
                Saved files
              </p>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {uploaded.map((file, index) => (
                  <li
                    key={`${file.folder}-${file.name}`}
                    className={`rounded-2xl border px-4 py-4 shadow-sm ${
                      index % 4 === 0
                        ? "border-sky-100 bg-sky-50/70"
                        : index % 4 === 1
                          ? "border-rose-100 bg-rose-50/70"
                          : index % 4 === 2
                            ? "border-amber-100 bg-amber-50/70"
                            : "border-violet-100 bg-violet-50/70"
                    }`}
                  >
                    <p className="break-all font-mono text-sm text-slate-700">
                      {file.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {Math.ceil(file.size / 1024)} KB
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/files/${file.id}`)}
                      className="mt-4 inline-flex rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      Open preview
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
