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
    <div className="grid gap-3">
      <section className="rounded-2xl border border-white/75 bg-white/88 p-3 shadow-[0_14px_36px_rgba(31,41,55,0.08)] backdrop-blur">
        <form onSubmit={submitSearch} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search folders, files, metadata, content"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeContent}
              onChange={(event) => setIncludeContent(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200"
            />
            Content
          </label>
          <button
            type="submit"
            className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Search
          </button>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            {totals} results
          </div>
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
          <section className="rounded-2xl border border-white/75 bg-white/84 p-4 shadow-[0_14px_36px_rgba(31,41,55,0.07)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Folders</h2>
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

          <section className="rounded-2xl border border-white/75 bg-white/84 p-4 shadow-[0_14px_36px_rgba(31,41,55,0.07)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Files</h2>
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
