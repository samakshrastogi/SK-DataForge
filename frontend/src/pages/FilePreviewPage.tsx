import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { clientEnv } from "../lib/env";

type MetricBlock = {
  type: "metric_grid";
  title: string;
  metrics: Array<{ label: string; value: string }>;
};

type BarListBlock = {
  type: "bar_list";
  title: string;
  subtitle?: string;
  valueFormat: "percent" | "number";
  items: Array<{ label: string; value: number }>;
};

type RangeCompareBlock = {
  type: "range_compare";
  title: string;
  subtitle?: string;
  items: Array<{ label: string; min: number; max: number; average: number }>;
};

type LineTrendBlock = {
  type: "line_trend";
  title: string;
  subtitle?: string;
  valueFormat: "number";
  items: Array<{ label: string; value: number }>;
};

type InsightBlock = MetricBlock | BarListBlock | RangeCompareBlock | LineTrendBlock;

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
    columns: Array<{
      name: string;
      kind: "number" | "date" | "boolean" | "text";
      identifier: boolean;
      nonEmptyCount: number;
      emptyCount: number;
      uniqueCount: number;
      fillRate: number;
      topValues: Array<{ value: string; count: number }>;
      numeric?: { min: number; max: number; average: number; sum: number };
      date?: { earliest: string; latest: string };
      boolean?: { trueCount: number; falseCount: number };
    }>;
    blocks: InsightBlock[];
  };
};

type PreviewResponse = {
  file: {
    id: string;
    name: string;
    originalName: string;
    folderName: string;
    size: number;
    mimeType: string;
    extension: string;
    category: string;
    updatedAt: string;
    contentUrl: string;
  };
  preview:
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
  relatedFiles: Array<{
    id: string;
    name: string;
    category: string;
    extension: string;
    updatedAt: string;
  }>;
};

type SortDirection = "asc" | "desc";
type AggregationMode = "count" | "sum" | "average";
type DateGranularity = "day" | "week" | "month";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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

function tryParseNumericCell(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function tryParseDateCell(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function getPeriodKey(date: Date, granularity: DateGranularity) {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (granularity === "week") {
    const next = new Date(date);
    const diff = (next.getDay() + 6) % 7;
    next.setDate(next.getDate() - diff);
    return next.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function buildPolylinePoints(values: number[]) {
  const maxValue = Math.max(...values, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 100 - (value / maxValue) * 100;
    return { x, y };
  });
}

function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadBlob(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MetricGridBlockView({ block }: { block: MetricBlock }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {block.metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.88),rgba(255,255,255,0.95),rgba(245,243,255,0.88))] px-3 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BarListBlockView({ block }: { block: BarListBlock }) {
  const maxValue = Math.max(...block.items.map((item) => item.value), 1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
        {block.subtitle ? <p className="text-xs text-slate-500">{block.subtitle}</p> : null}
      </div>
      <div className="grid gap-2">
        {block.items.map((item) => (
          <div key={item.label} className="grid gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-500">
                {block.valueFormat === "percent" ? formatPercent(item.value) : formatNumber(item.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RangeCompareBlockView({ block }: { block: RangeCompareBlock }) {
  const globalMax = Math.max(...block.items.map((item) => item.max), 1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
        {block.subtitle ? <p className="text-xs text-slate-500">{block.subtitle}</p> : null}
      </div>
      <div className="grid gap-3">
        {block.items.map((item) => (
          <div key={item.label} className="grid gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-500">{formatNumber(item.min)} to {formatNumber(item.max)}</span>
            </div>
            <div className="relative h-3 rounded-full bg-slate-100">
              <div className="absolute left-0 top-0 h-full rounded-full bg-amber-400/70" style={{ width: `${(item.max / globalMax) * 100}%` }} />
              <div className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-slate-900" style={{ left: `calc(${(item.average / globalMax) * 100}% - 3px)` }} />
            </div>
            <p className="text-[11px] text-slate-500">Average {formatNumber(item.average)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LineTrendBlockView({ block }: { block: LineTrendBlock }) {
  const maxValue = Math.max(...block.items.map((item) => item.value), 1);
  const points = block.items.map((item, index) => {
    const x = block.items.length === 1 ? 0 : (index / (block.items.length - 1)) * 100;
    const y = 100 - (item.value / maxValue) * 100;
    return `${x},${y}`;
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{block.title}</h2>
        {block.subtitle ? <p className="text-xs text-slate-500">{block.subtitle}</p> : null}
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible">
          <polyline fill="none" stroke="#0f172a" strokeWidth="2" points={points.join(" ")} />
          {block.items.map((item, index) => {
            const x = block.items.length === 1 ? 0 : (index / (block.items.length - 1)) * 100;
            const y = 100 - (item.value / maxValue) * 100;
            return <circle key={item.label} cx={x} cy={y} r="2.4" fill="#0ea5e9" />;
          })}
        </svg>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DynamicDonutChart({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="-rotate-90 h-24 w-24">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5eef9" strokeWidth="12" />
            {items.map((item) => {
              const dash = total > 0 ? (item.value / total) * circumference : 0;
              const currentOffset = -offset;
              offset += dash;
              return (
                <circle
                  key={item.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={currentOffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(total)}</span>
          </div>
        </div>
        <div className="grid flex-1 gap-2">
          {items.slice(0, 5).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate font-medium text-slate-700">{item.label}</span>
              </div>
              <span className="text-slate-500">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsightBlockRenderer({ block }: { block: InsightBlock }) {
  switch (block.type) {
    case "metric_grid":
      return <MetricGridBlockView block={block} />;
    case "bar_list":
      return <BarListBlockView block={block} />;
    case "range_compare":
      return <RangeCompareBlockView block={block} />;
    case "line_trend":
      return <LineTrendBlockView block={block} />;
    default:
      return null;
  }
}

export default function FilePreviewPage() {
  const navigate = useNavigate();
  const { fileId } = useParams();
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [previewResponse, setPreviewResponse] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "insights">("preview");
  const [sectionHeight, setSectionHeight] = useState(720);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupByColumn, setGroupByColumn] = useState("");
  const [measureColumn, setMeasureColumn] = useState("");
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>("count");
  const [dateColumn, setDateColumn] = useState("");
  const [dateGranularity, setDateGranularity] = useState<DateGranularity>("day");
  const [topN, setTopN] = useState("5");

  useEffect(() => {
    const loadPreview = async () => {
      if (!fileId) {
        setError("No file selected.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${clientEnv.apiUrl}/uploads/files/${fileId}/preview`);
        const data = (await response.json()) as PreviewResponse | { message: string };

        if (!response.ok) {
          throw new Error((data as { message: string }).message);
        }

        setPreviewResponse(data as PreviewResponse);
        setError(null);
        setActiveTab("preview");
        setSearchQuery("");
        setSearchOpen(false);
        setDownloadMenuOpen(false);
        setSortColumn(null);
        setGroupByColumn("");
        setMeasureColumn("");
        setAggregationMode("count");
        setDateColumn("");
        setDateGranularity("day");
        setTopN("5");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load file preview.");
        setPreviewResponse(null);
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();
  }, [fileId]);

  useLayoutEffect(() => {
    const updateSectionHeight = () => {
      if (!previewRootRef.current) {
        return;
      }

      const rect = previewRootRef.current.getBoundingClientRect();
      const availableHeight = Math.floor(window.innerHeight - rect.top - 16);
      setSectionHeight(Math.max(720, availableHeight));
    };

    updateSectionHeight();
    window.addEventListener("resize", updateSectionHeight);
    document.addEventListener("fullscreenchange", updateSectionHeight);

    return () => {
      window.removeEventListener("resize", updateSectionHeight);
      document.removeEventListener("fullscreenchange", updateSectionHeight);
    };
  }, []);

  useEffect(() => {
    if (!previewResponse) {
      return;
    }

    try {
      window.localStorage.setItem(
        "recent-preview-file",
        JSON.stringify({
          id: previewResponse.file.id,
          name: previewResponse.file.name,
          folderName: previewResponse.file.folderName
        })
      );
    } catch {
      // Ignore localStorage failures for non-critical dashboard shortcut data.
    }
  }, [previewResponse]);

  const tablePreview = previewResponse?.preview.kind === "table" ? previewResponse.preview : null;
  const pdfPreview = previewResponse?.preview.kind === "pdf" ? previewResponse.preview : null;
  const textPreview = previewResponse?.preview.kind === "text" ? previewResponse.preview : null;

  const currentFileIndex = useMemo(() => {
    if (!previewResponse) {
      return -1;
    }

    return previewResponse.relatedFiles.findIndex((item) => item.id === previewResponse.file.id);
  }, [previewResponse]);

  const previousFile = previewResponse && currentFileIndex > 0 ? previewResponse.relatedFiles[currentFileIndex - 1] : null;
  const nextFile =
    previewResponse && currentFileIndex >= 0 && currentFileIndex < previewResponse.relatedFiles.length - 1
      ? previewResponse.relatedFiles[currentFileIndex + 1]
      : null;

  const filePath = useMemo(() => {
    if (!previewResponse) {
      return "";
    }

    return `${previewResponse.file.folderName} / ${previewResponse.file.name}`;
  }, [previewResponse]);

  const filteredTableRows = useMemo(() => {
    if (!tablePreview) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();
    let rows = tablePreview.rows.filter((row) =>
      !query ? true : row.values.some((value) => value.toLowerCase().includes(query))
    );

    if (sortColumn !== null) {
      rows = [...rows].sort((left, right) => {
        const leftValue = left.values[sortColumn] || "";
        const rightValue = right.values[sortColumn] || "";
        const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return rows;
  }, [tablePreview, searchQuery, sortColumn, sortDirection]);

  const numericInsightColumns = useMemo(
    () => tablePreview?.insights.columns.filter((column) => column.kind === "number" && !column.identifier) || [],
    [tablePreview]
  );

  const dateInsightColumns = useMemo(
    () => tablePreview?.insights.columns.filter((column) => column.kind === "date") || [],
    [tablePreview]
  );

  const dimensionInsightColumns = useMemo(
    () =>
      tablePreview?.insights.columns.filter(
        (column) =>
          !column.identifier &&
          (column.kind === "text" || column.kind === "boolean") &&
          column.uniqueCount > 0 &&
          column.uniqueCount <= Math.max(16, Math.floor((tablePreview.rows.length || 1) * 0.35))
      ) || [],
    [tablePreview]
  );

  useEffect(() => {
    if (!tablePreview) {
      return;
    }

    if (!groupByColumn && dimensionInsightColumns[0]) {
      setGroupByColumn(dimensionInsightColumns[0].name);
    }

    if (!measureColumn && numericInsightColumns[0]) {
      setMeasureColumn(numericInsightColumns[0].name);
    }

    if (!dateColumn && dateInsightColumns[0]) {
      setDateColumn(dateInsightColumns[0].name);
    }
  }, [tablePreview, groupByColumn, measureColumn, dateColumn, dimensionInsightColumns, numericInsightColumns, dateInsightColumns]);

  const filteredTextContent = useMemo(() => {
    if (!textPreview) {
      return "";
    }

    if (!searchQuery.trim()) {
      return textPreview.content;
    }

    return textPreview.content
      .split(/\r?\n/)
      .filter((line) => line.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      .join("\n");
  }, [textPreview, searchQuery]);

  const dynamicInsights = useMemo(() => {
    if (!tablePreview) {
      return null;
    }

    const palette = ["#0ea5e9", "#7c3aed", "#ef4444", "#f59e0b", "#10b981", "#a855f7", "#14b8a6"];
    const columns = tablePreview.columns;
    const rows = filteredTableRows;
    const dimensionIndex = columns.indexOf(groupByColumn);
    const measureIndex = columns.indexOf(measureColumn);
    const dateIndex = columns.indexOf(dateColumn);
    const effectiveTopN = Number(topN) || 5;

    const grouped = new Map<string, { count: number; sum: number }>();

    if (dimensionIndex >= 0) {
      for (const row of rows) {
        const key = row.values[dimensionIndex] || "(Blank)";
        const numericValue = measureIndex >= 0 ? tryParseNumericCell(row.values[measureIndex]) : null;
        const current = grouped.get(key) || { count: 0, sum: 0 };
        current.count += 1;
        current.sum += numericValue || 0;
        grouped.set(key, current);
      }
    }

    const groupedItems = Array.from(grouped.entries())
      .map(([label, value]) => {
        const metricValue =
          aggregationMode === "count"
            ? value.count
            : aggregationMode === "sum"
              ? value.sum
              : value.count > 0
                ? value.sum / value.count
                : 0;

        return { label, value: Number(metricValue.toFixed(2)) };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, effectiveTopN);

    const trendMap = new Map<string, { count: number; sum: number }>();
    if (dateIndex >= 0) {
      for (const row of rows) {
        const parsedDate = tryParseDateCell(row.values[dateIndex]);
        if (!parsedDate) {
          continue;
        }
        const key = getPeriodKey(parsedDate, dateGranularity);
        const numericValue = measureIndex >= 0 ? tryParseNumericCell(row.values[measureIndex]) : null;
        const current = trendMap.get(key) || { count: 0, sum: 0 };
        current.count += 1;
        current.sum += numericValue || 0;
        trendMap.set(key, current);
      }
    }

    const trendItems = Array.from(trendMap.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-12)
      .map(([label, value]) => ({
        label,
        value:
          aggregationMode === "count"
            ? value.count
            : aggregationMode === "sum"
              ? Number(value.sum.toFixed(2))
              : Number((value.count > 0 ? value.sum / value.count : 0).toFixed(2))
      }));

    const trendPoints = buildPolylinePoints(trendItems.map((item) => item.value));
    const metricCards = [
      { label: "Filtered rows", value: formatNumber(rows.length) },
      { label: "Group by", value: groupByColumn || "None" },
      { label: "Measure", value: aggregationMode === "count" ? "Count rows" : `${aggregationMode} ${measureColumn || ""}`.trim() },
      { label: "Time grain", value: dateColumn ? dateGranularity : "No date column" }
    ];

    return {
      metricCards,
      groupedItems,
      trendItems,
      trendPoints,
      donutItems: groupedItems.map((item, index) => ({
        ...item,
        color: palette[index % palette.length]
      })),
      topInsight:
        groupedItems[0] && groupByColumn
          ? `${groupedItems[0].label} leads ${groupByColumn} with ${formatNumber(groupedItems[0].value)}.`
          : null,
      trendInsight:
        trendItems.length >= 2
          ? `${trendItems[trendItems.length - 1].label} is the latest visible ${dateGranularity} bucket with ${formatNumber(
              trendItems[trendItems.length - 1].value
            )}.`
          : null
    };
  }, [
    tablePreview,
    filteredTableRows,
    groupByColumn,
    measureColumn,
    aggregationMode,
    dateColumn,
    dateGranularity,
    topN
  ]);

  const toggleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(columnIndex);
    setSortDirection("asc");
  };

  const searchEnabled = Boolean(tablePreview || textPreview);
  const searchPlaceholder = tablePreview ? "Search rows" : textPreview ? "Search text" : "Search unavailable";

  const exportTable = async (format: "csv" | "xlsx") => {
    if (!previewResponse) {
      return;
    }

    const response = await fetch(
      `${clientEnv.apiUrl}/uploads/files/${previewResponse.file.id}/export?format=${format}`
    );

    if (!response.ok) {
      throw new Error("Failed to export table.");
    }

    const blob = await response.blob();
    downloadBlob(
      blob,
      `${previewResponse.file.name.replace(/\.[^/.]+$/, "")}.${format}`,
      format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  const exportCurrentCsv = () => {
    if (!tablePreview) {
      return;
    }

    const csvLines = [
      tablePreview.columns.map(escapeCsvCell).join(","),
      ...filteredTableRows.map((row) => row.values.map(escapeCsvCell).join(","))
    ];
    downloadBlob(csvLines.join("\n"), `${previewResponse?.file.name || "preview"}.csv`, "text/csv");
  };

  const downloadOriginal = () => {
    if (!previewResponse) {
      return;
    }

    const link = document.createElement("a");
    link.href = previewResponse.file.contentUrl;
    link.download = previewResponse.file.name;
    link.click();
  };

  const handleDownloadClick = () => {
    if (tablePreview) {
      setDownloadMenuOpen((current) => !current);
      return;
    }

    downloadOriginal();
  };

  const toggleFullscreen = async () => {
    if (!previewRootRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await previewRootRef.current.requestFullscreen();
  };

  return (
    <section
      ref={previewRootRef}
      style={{ height: `${sectionHeight}px` }}
      className="mt-3 min-h-[720px] overflow-hidden rounded-[30px] border border-white/80 bg-white/80 shadow-[0_22px_70px_rgba(99,102,241,0.12)] backdrop-blur"
    >
      <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-5">
        <div className="shrink-0 border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/manager")}
                aria-label="Back to file manager"
                title="Back to file manager"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <BackIcon />
              </button>
              <p className="truncate text-sm text-slate-500">{filePath || "Loading file path..."}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {previousFile ? (
                <button
                  type="button"
                  onClick={() => navigate(`/files/${previousFile.id}`)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  title="Previous file"
                >
                  <ArrowIcon direction="left" />
                </button>
              ) : null}
              {nextFile ? (
                <button
                  type="button"
                  onClick={() => navigate(`/files/${nextFile.id}`)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  title="Next file"
                >
                  <ArrowIcon direction="right" />
                </button>
              ) : null}
              <div
                className={`flex items-center overflow-hidden rounded-md border bg-white transition ${
                  searchEnabled ? "border-slate-300 text-slate-700 hover:border-sky-400 focus-within:border-sky-500" : "border-slate-200 text-slate-400"
                }`}
                onMouseEnter={() => {
                  if (searchEnabled) {
                    setSearchOpen(true);
                  }
                }}
                onMouseLeave={() => {
                  if (searchEnabled && !searchQuery) {
                    setSearchOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  title={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  disabled={!searchEnabled}
                  onClick={() => {
                    if (searchEnabled) {
                      setSearchOpen((current) => !current);
                    }
                  }}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed"
                >
                  <SearchIcon />
                </button>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => {
                    if (searchEnabled) {
                      setSearchOpen(true);
                    }
                  }}
                  onBlur={() => {
                    if (searchEnabled && !searchQuery) {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  disabled={!searchEnabled}
                  className={`bg-transparent text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 disabled:cursor-not-allowed ${
                    searchOpen || !!searchQuery ? "h-11 w-56 pr-3 opacity-100" : "h-11 w-0 pr-0 opacity-0"
                  }`}
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  title="Download"
                  aria-label="Download"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <DownloadIcon />
                </button>
                {tablePreview && downloadMenuOpen ? (
                  <div className="absolute right-0 top-12 z-20 min-w-[160px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        exportCurrentCsv();
                        setDownloadMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Download CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void exportTable("xlsx");
                        setDownloadMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Download XLSX
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadOriginal();
                        setDownloadMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      Download original
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                title="Full screen"
                aria-label="Full screen"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <FullscreenIcon />
              </button>
            </div>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-3 text-slate-600">
            Loading file preview...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-3 text-rose-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && previewResponse ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {tablePreview ? (
                <div className="inline-flex w-fit rounded-2xl border border-white/80 bg-white/70 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("insights")}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === "insights" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Insights
                  </button>
                </div>
              ) : null}

              {activeTab === "insights" && tablePreview ? (
                <div className="grid gap-4">
                  <section className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.88),rgba(255,255,255,0.95),rgba(245,243,255,0.9))] p-3 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <SelectField
                        label="Group by"
                        value={groupByColumn}
                        onChange={setGroupByColumn}
                        options={(dimensionInsightColumns.length
                          ? dimensionInsightColumns
                          : tablePreview.insights.columns
                        ).map((column) => ({ value: column.name, label: column.name }))}
                      />
                      <SelectField
                        label="Measure"
                        value={aggregationMode}
                        onChange={(value) => setAggregationMode(value as AggregationMode)}
                        options={[
                          { value: "count", label: "Count rows" },
                          { value: "sum", label: "Sum numeric column" },
                          { value: "average", label: "Average numeric column" }
                        ]}
                      />
                      <SelectField
                        label="Value column"
                        value={measureColumn}
                        onChange={setMeasureColumn}
                        options={(numericInsightColumns.length ? numericInsightColumns : tablePreview.insights.columns).map((column) => ({
                          value: column.name,
                          label: column.name
                        }))}
                      />
                      <SelectField
                        label="Date grain"
                        value={dateGranularity}
                        onChange={(value) => setDateGranularity(value as DateGranularity)}
                        options={[
                          { value: "day", label: "Day" },
                          { value: "week", label: "Week" },
                          { value: "month", label: "Month" }
                        ]}
                      />
                      <SelectField
                        label="Top N"
                        value={topN}
                        onChange={setTopN}
                        options={[
                          { value: "5", label: "Top 5" },
                          { value: "8", label: "Top 8" },
                          { value: "10", label: "Top 10" }
                        ]}
                      />
                    </div>
                  </section>

                  {dynamicInsights ? (
                    <>
                      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {dynamicInsights.metricCards.map((metric) => (
                          <article key={metric.label} className="rounded-2xl border border-white/80 bg-white/92 px-3 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</p>
                          </article>
                        ))}
                      </section>

                      {(dynamicInsights.topInsight || dynamicInsights.trendInsight) ? (
                        <section className="grid gap-3 lg:grid-cols-2">
                          {dynamicInsights.topInsight ? (
                            <article className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.88),rgba(255,255,255,0.95),rgba(250,245,255,0.9))] px-3 py-3 shadow-sm">
                              <h2 className="text-sm font-semibold text-slate-900">Top group insight</h2>
                              <p className="mt-1 text-sm text-slate-600">{dynamicInsights.topInsight}</p>
                            </article>
                          ) : null}
                          {dynamicInsights.trendInsight ? (
                            <article className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(255,255,255,0.95),rgba(239,246,255,0.88))] px-3 py-3 shadow-sm">
                              <h2 className="text-sm font-semibold text-slate-900">Trend insight</h2>
                              <p className="mt-1 text-sm text-slate-600">{dynamicInsights.trendInsight}</p>
                            </article>
                          ) : null}
                        </section>
                      ) : null}

                      <div className="grid gap-4 xl:grid-cols-2">
                        {dynamicInsights.groupedItems.length ? (
                          <BarListBlockView
                            block={{
                              type: "bar_list",
                              title: `${groupByColumn || "Category"} breakdown`,
                              subtitle: aggregationMode === "count" ? "Grouped by row count" : `Grouped by ${aggregationMode}`,
                              valueFormat: "number",
                              items: dynamicInsights.groupedItems
                            }}
                          />
                        ) : null}

                        {dynamicInsights.donutItems.length ? (
                          <DynamicDonutChart
                            title={`${groupByColumn || "Category"} share`}
                            items={dynamicInsights.donutItems}
                          />
                        ) : null}

                        {dynamicInsights.trendItems.length >= 2 ? (
                          <section className="rounded-lg border border-slate-200 bg-white p-3 xl:col-span-2">
                            <div className="mb-3">
                              <h2 className="text-sm font-semibold text-slate-900">Trend over time</h2>
                              <p className="text-xs text-slate-500">
                                {dateColumn || "Date"} by {aggregationMode === "count" ? "row count" : `${aggregationMode} ${measureColumn || ""}`.trim()}
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible">
                                <polyline
                                  fill="none"
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                  points={dynamicInsights.trendPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                                />
                                {dynamicInsights.trendPoints.map((point, index) => (
                                  <circle key={`${dynamicInsights.trendItems[index]?.label || index}`} cx={point.x} cy={point.y} r="2.4" fill="#10b981" />
                                ))}
                              </svg>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500 sm:grid-cols-4 xl:grid-cols-6">
                              {dynamicInsights.trendItems.map((item) => (
                                <span key={item.label} className="truncate text-center">
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  <div className="grid gap-3 lg:grid-cols-2">
                    {tablePreview.insights.highlights.map((highlight) => (
                      <article key={highlight.title} className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.88),rgba(255,255,255,0.95),rgba(250,245,255,0.9))] px-3 py-3 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-900">{highlight.title}</h2>
                        <p className="mt-1 text-sm text-slate-600">{highlight.detail}</p>
                      </article>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {tablePreview.insights.blocks.map((block, index) => (
                      <InsightBlockRenderer key={`${block.type}-${index}`} block={block} />
                    ))}
                  </div>
                </div>
              ) : tablePreview ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                  <div className="min-h-0 flex-1 overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {tablePreview.columns.map((column, index) => (
                            <th key={column} className="border-b border-slate-200 px-3 py-2 font-medium text-slate-700">
                              <button
                                type="button"
                                onClick={() => toggleSort(index)}
                                className="inline-flex items-center gap-2 hover:text-slate-900"
                              >
                                {column}
                                {sortColumn === index ? (sortDirection === "asc" ? "↑" : "↓") : null}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTableRows.map((row, rowIndex) => (
                          <tr key={row.id} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                            {row.values.map((cell, cellIndex) => (
                              <td key={`${row.id}-${cellIndex}`} className="border-b border-slate-100 px-3 py-2 align-top text-xs text-slate-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : previewResponse.preview.kind === "pdf" ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                  <iframe
                    src={pdfPreview?.contentUrl}
                    title={previewResponse.file.name}
                    className="block h-full min-h-0 w-full"
                  />
                </div>
              ) : previewResponse.preview.kind === "text" ? (
                <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-slate-800/90 bg-[linear-gradient(180deg,#0f172a,#020617)] p-4 text-xs text-slate-100 shadow-[0_16px_44px_rgba(15,23,42,0.18)]">
                  <div className="mb-3 flex items-center justify-between gap-2 text-slate-400">
                    <span>{previewResponse.preview.lineCount} lines</span>
                    {previewResponse.preview.truncated ? <span>Preview truncated</span> : null}
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono">
                    {filteredTextContent || "No matching lines found."}
                  </pre>
                </div>
              ) : previewResponse.preview.kind === "media" ? (
                <div className="flex min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-4">
                  {previewResponse.preview.mediaType === "video" ? (
                    <video controls className="h-full w-full rounded-lg bg-black" src={previewResponse.preview.contentUrl} />
                  ) : (
                    <audio controls className="w-full" src={previewResponse.preview.contentUrl} />
                  )}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.88),rgba(255,255,255,0.96),rgba(250,245,255,0.88))] p-4 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                  <p className="text-sm text-slate-700">
                    {"message" in previewResponse.preview ? previewResponse.preview.message : "Inline preview is not available for this file type."}
                  </p>
                  {"contentUrl" in previewResponse.preview ? (
                    <a
                      href={previewResponse.preview.contentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      <DownloadIcon />
                      Open file
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
