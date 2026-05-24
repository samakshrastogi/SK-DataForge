import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { clientEnv } from "../lib/env";

type SearchResponse = {
  query: string;
  includeContent: boolean;
  totals: {
    folders: number;
    files: number;
  };
  folders: Array<{
    id: string;
    name: string;
    path: string;
    matchedFields: string[];
  }>;
  files: Array<{
    id: string;
    name: string;
    originalName: string;
    folderName: string;
    path: string;
    extension: string;
    category: string;
    size: number;
    updatedAt: string;
    matchedFields: string[];
    snippet: string | null;
  }>;
};

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

function SearchFieldTag({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
      {value}
    </span>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialIncludeContent = searchParams.get("includeContent") === "true";
  const [query, setQuery] = useState(initialQuery);
  const [includeContent, setIncludeContent] = useState(initialIncludeContent);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setIncludeContent(initialIncludeContent);
  }, [initialIncludeContent, initialQuery]);

  useEffect(() => {
    const currentQuery = searchParams.get("q")?.trim() || "";
    const currentIncludeContent = searchParams.get("includeContent") === "true";

    const loadResults = async () => {
      try {
        setLoading(true);
        const requestUrl = new URL(`${clientEnv.apiUrl}/search`);
        requestUrl.searchParams.set("q", currentQuery);
        if (currentIncludeContent) {
          requestUrl.searchParams.set("includeContent", "true");
        }

        const response = await fetch(requestUrl.toString());
        const data = (await response.json()) as SearchResponse | { message: string };

        if (!response.ok) {
          throw new Error((data as { message: string }).message);
        }

        setResults(data as SearchResponse);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Failed to search workspace."
        );
        setResults(null);
      } finally {
        setLoading(false);
      }
    };

    void loadResults();
  }, [searchParams]);

  const totals = useMemo(() => {
    if (!results) {
      return 0;
    }

    return results.totals.folders + results.totals.files;
  }, [results]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextParams = new URLSearchParams();
    const trimmed = query.trim();

    if (trimmed) {
      nextParams.set("q", trimmed);
    }

    if (includeContent) {
      nextParams.set("includeContent", "true");
    }

    setSearchParams(nextParams);
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.94),rgba(245,243,255,0.92))] p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">
              Workspace Search
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Search folders, file metadata, and file content from one place.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Match folder names, file names, extensions, categories, paths, and optionally text or table content.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_16px_40px_rgba(14,165,233,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Results
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals}</p>
            <p className="mt-1 text-xs text-slate-500">
              {results?.totals.folders || 0} folders and {results?.totals.files || 0} files
            </p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by folder, file, extension, category, or content"
            className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <label className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeContent}
              onChange={(event) => setIncludeContent(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200"
            />
            Include text and table content
          </label>
          <button
            type="submit"
            className="rounded-[18px] bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(99,102,241,0.24)] transition hover:-translate-y-0.5 hover:opacity-95"
          >
            Search
          </button>
        </form>
      </section>

      {loading ? (
        <div className="rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-violet-50 px-4 py-3 text-slate-600">
          Searching workspace...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && results ? (
        <>
          <section className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-500">
                  Folders
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Matching folders
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {results.totals.folders}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {results.folders.length ? (
                results.folders.map((folder) => (
                  <Link
                    key={folder.id}
                    to={`/manager/folders/${folder.id}`}
                    className="rounded-[22px] border border-slate-100 bg-white/90 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sky-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900">
                          {folder.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{folder.path}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {folder.matchedFields.map((field) => (
                          <SearchFieldTag key={`${folder.id}-${field}`} value={field} />
                        ))}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/72 px-4 py-4 text-sm text-slate-500">
                  No folders matched this query.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-500">
                  Files
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Matching files</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {results.totals.files}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {results.files.length ? (
                results.files.map((file) => (
                  <Link
                    key={file.id}
                    to={`/files/${file.id}`}
                    className="rounded-[22px] border border-slate-100 bg-white/90 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sky-200"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-slate-900">
                            {file.name}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            {file.extension || "file"}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            {file.category}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{file.path}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {file.folderName} · {formatFileSize(file.size)} · Updated{" "}
                          {formatModifiedDate(file.updatedAt)}
                        </p>
                        {file.snippet ? (
                          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                            {file.snippet}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {file.matchedFields.map((field) => (
                          <SearchFieldTag key={`${file.id}-${field}`} value={field} />
                        ))}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/72 px-4 py-4 text-sm text-slate-500">
                  No files matched this query.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
