import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clientEnv } from "../lib/env";

type DashboardResponse = {
  stats: {
    totalFolders: number;
    totalFiles: number;
    recentUploads: number;
    tableFiles: number;
    documentFiles: number;
    storageUsed: number;
  };
  fileTypeAnalytics: Array<{
    extension: string;
    count: number;
    percentage: number;
  }>;
  uploadTrend: {
    uploadedToday: number;
    uploadedThisWeek: number;
    uploadedThisMonth: number;
    peakUploadHour: number;
    peakUploadHourLabel: string;
    averageUploadsPerDay: number;
    dailySeries: Array<{
      date: string;
      label: string;
      count: number;
    }>;
  };
  storageBreakdown: {
    totalCapacity: number;
    remainingCapacity: number;
    usedPercentage: number;
    growthRateThisWeek: number;
    warningThresholds?: number[];
    workspaceName?: string;
    topFolders: Array<{
      id: string;
      name: string;
      storageUsed: number;
      fileCount: number;
      percentage: number;
    }>;
    largestFiles: Array<{
      id: string;
      name: string;
      folderName: string;
      extension: string;
      size: number;
    }>;
  };
  recentFiles: Array<{
    id: string;
    name: string;
    folderName: string;
    category: string;
    extension: string;
    size: number;
    updatedAt: string;
  }>;
};

type WorkspaceResponse = {
  id: string;
  name: string;
  adminLabel: string;
  quotaBytes: number;
  usedBytes: number;
  usedPercentage: number;
  remainingBytes: number;
  warningThresholds: number[];
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStorageGb(size: number) {
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

function StatCard({
  label,
  value,
  accentClass
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <article
      className={`relative min-w-[220px] flex-1 overflow-hidden rounded-[24px] border border-white/75 px-4 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.08)] backdrop-blur ${accentClass}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 rounded-full bg-white/80" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-800">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function FileTypeBar({
  extension,
  count,
  percentage,
  color
}: {
  extension: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/72 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold uppercase text-slate-800">{extension}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{count}</span>
        <span className="w-10 text-right">{percentage}%</span>
      </div>
    </div>
  );
}

function buildLineChartPath(values: number[], width: number, height: number, padding: number) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotaForm, setQuotaForm] = useState({
    name: "",
    adminLabel: "",
    quotaGb: "30",
    warningThresholds: "75,90,100"
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [dashboardResponse, workspaceResponse] = await Promise.all([
          fetch(`${clientEnv.apiUrl}/dashboard`),
          fetch(`${clientEnv.apiUrl}/workspace`)
        ]);
        const data = (await dashboardResponse.json()) as DashboardResponse | { message: string };
        const workspaceData = (await workspaceResponse.json()) as WorkspaceResponse;

        if (!dashboardResponse.ok) {
          throw new Error((data as { message: string }).message);
        }

        setDashboard(data as DashboardResponse);
        if (workspaceResponse.ok) {
          setWorkspace(workspaceData);
          setQuotaForm({
            name: workspaceData.name,
            adminLabel: workspaceData.adminLabel,
            quotaGb: (workspaceData.quotaBytes / (1024 * 1024 * 1024)).toFixed(2),
            warningThresholds: workspaceData.warningThresholds.join(",")
          });
        }
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard.");
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const saveQuotaSettings = async () => {
    const response = await fetch(`${clientEnv.apiUrl}/workspace`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: quotaForm.name.trim(),
        adminLabel: quotaForm.adminLabel.trim(),
        quotaBytes: Math.round(Number(quotaForm.quotaGb || "0") * 1024 * 1024 * 1024),
        warningThresholds: quotaForm.warningThresholds
          .split(",")
          .map((value) => Number(value.trim()))
      })
    });

    if (!response.ok) {
      throw new Error("Failed to update workspace settings.");
    }

    const refreshed = await fetch(`${clientEnv.apiUrl}/workspace`);
    const refreshedWorkspace = (await refreshed.json()) as WorkspaceResponse;
    setWorkspace(refreshedWorkspace);
  };

  const quickLinks = useMemo(
    () =>
      [
        { title: "Upload files", href: "/upload" },
        { title: "Open manager", href: "/manager" }
      ] as Array<{ title: string; href: string }>,
    []
  );

  const analyticsColors = useMemo(
    () => ({
      pdf: "#ef4444",
      csv: "#06b6d4",
      json: "#2563eb",
      log: "#f59e0b",
      xlsx: "#22c55e",
      txt: "#a855f7"
    }),
    []
  );

  const donutChart = useMemo(() => {
    const items = [...(dashboard?.fileTypeAnalytics ?? [])].sort((left, right) => right.count - left.count);
    const total = dashboard?.stats.totalFiles ?? 0;
    const trackedTotal = items.reduce((sum, item) => sum + item.count, 0);
    const radius = 52;
    const strokeWidth = 16;
    const circumference = 2 * Math.PI * radius;
    let offsetCursor = 0;

    const segments = items.map((item) => {
      const value = total > 0 ? item.count / total : 0;
      const dash = circumference * value;
      const segment = {
        extension: item.extension,
        count: item.count,
        percentage: item.percentage,
        stroke: analyticsColors[item.extension as keyof typeof analyticsColors] || "#94a3b8",
        dash,
        offset: -offsetCursor
      };
      offsetCursor += dash;
      return segment;
    });

    const otherCount = Math.max(total - trackedTotal, 0);
    const otherDash = total > 0 ? circumference * (otherCount / total) : 0;

    return { total, trackedTotal, otherCount, otherDash, radius, strokeWidth, circumference, segments };
  }, [analyticsColors, dashboard]);

  const uploadTrendChart = useMemo(() => {
    const series = dashboard?.uploadTrend.dailySeries ?? [];
    const width = 320;
    const height = 140;
    const padding = 16;
    const values = series.map((item) => item.count);
    const path = buildLineChartPath(values, width, height, padding);
    const max = Math.max(...values, 1);
    const points = values.map((value, index) => {
      const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
      const x = padding + stepX * index;
      const y = height - padding - (value / max) * (height - padding * 2);
      return { x, y, value, label: series[index]?.label || "" };
    });

    return { width, height, path, points };
  }, [dashboard]);

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-[32px] border border-white/75 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.9),rgba(253,242,248,0.92))] p-5 shadow-[0_24px_70px_rgba(31,41,55,0.10)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-3xl xl:pr-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-500">Home</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Start from one place, then upload, manage, or preview files directly.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Keep the home page focused on the next action and the latest workspace activity.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(248,250,252,0.86),rgba(245,243,255,0.82))] p-3 shadow-[0_18px_48px_rgba(99,102,241,0.10)] xl:ml-6 xl:shrink-0">
            <div className="flex flex-wrap gap-2 xl:flex-nowrap">
              {quickLinks.map((item, index) => (
                <Link
                  key={item.title}
                  to={item.href}
                  className={
                    index === 0
                      ? "inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[linear-gradient(90deg,#0ea5e9,#7c3aed,#ec4899)] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_14px_34px_rgba(139,92,246,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(236,72,153,0.24)]"
                      : "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-sky-100/80 bg-white/92 px-4 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white"
                  }
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[24px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-violet-50 px-4 py-3 text-slate-600">
          Loading home...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && dashboard ? (
        <>
          {workspace ? (
            <section className="rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(236,253,245,0.94),rgba(255,255,255,0.94),rgba(239,246,255,0.92))] p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">
                    Quota Controls
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Real workspace quota and warning thresholds
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Storage is now enforced from persisted workspace settings instead of a static constant. Warning notifications are generated when configured thresholds are crossed.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Used</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">{formatStorageGb(workspace.usedBytes)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Remaining</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">{formatStorageGb(workspace.remainingBytes)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Usage</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">{workspace.usedPercentage}%</p>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xl rounded-[24px] border border-white/90 bg-white/88 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={quotaForm.name}
                      onChange={(event) => setQuotaForm({ ...quotaForm, name: event.target.value })}
                      placeholder="Workspace name"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                    <input
                      type="text"
                      value={quotaForm.adminLabel}
                      onChange={(event) => setQuotaForm({ ...quotaForm, adminLabel: event.target.value })}
                      placeholder="Admin label"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      value={quotaForm.quotaGb}
                      onChange={(event) => setQuotaForm({ ...quotaForm, quotaGb: event.target.value })}
                      placeholder="Quota (GB)"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                    <input
                      type="text"
                      value={quotaForm.warningThresholds}
                      onChange={(event) => setQuotaForm({ ...quotaForm, warningThresholds: event.target.value })}
                      placeholder="75,90,100"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveQuotaSettings()}
                    className="mt-4 rounded-xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] px-4 py-3 text-sm font-semibold text-white"
                  >
                    Save workspace settings
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="flex gap-3 overflow-x-auto pb-1">
            <StatCard
              label="Folders"
              value={String(dashboard.stats.totalFolders)}
              accentClass="bg-[linear-gradient(135deg,rgba(56,189,248,0.26),rgba(14,165,233,0.16),rgba(255,255,255,0.9))]"
            />
            <StatCard
              label="Files"
              value={String(dashboard.stats.totalFiles)}
              accentClass="bg-[linear-gradient(135deg,rgba(139,92,246,0.24),rgba(99,102,241,0.16),rgba(255,255,255,0.9))]"
            />
            <StatCard
              label="Recent uploads"
              value={String(dashboard.stats.recentUploads)}
              accentClass="bg-[linear-gradient(135deg,rgba(244,114,182,0.24),rgba(236,72,153,0.16),rgba(255,255,255,0.9))]"
            />
            <StatCard
              label="Storage"
              value={formatFileSize(dashboard.stats.storageUsed)}
              accentClass="bg-[linear-gradient(135deg,rgba(251,191,36,0.24),rgba(249,115,22,0.16),rgba(255,255,255,0.92))]"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
              <aside className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-500">File type analytics</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">What fills the workspace most</h2>
                <div className="mt-4 grid gap-5">
                  <div className="rounded-[24px] border border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(248,250,252,0.78),rgba(240,249,255,0.8))] p-4">
                    <div className="flex items-center gap-5">
                      <div className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_30px_rgba(148,163,184,0.12)]">
                        <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
                          <circle cx="70" cy="70" r={donutChart.radius} fill="none" stroke="#e5eef9" strokeWidth={donutChart.strokeWidth} />
                          {donutChart.otherCount > 0 ? (
                            <circle
                              cx="70"
                              cy="70"
                              r={donutChart.radius}
                              fill="none"
                              stroke="#cbd5e1"
                              strokeWidth={donutChart.strokeWidth}
                              strokeDasharray={`${donutChart.otherDash} ${donutChart.circumference - donutChart.otherDash}`}
                              strokeDashoffset={-(donutChart.circumference - donutChart.otherDash)}
                            />
                          ) : null}
                          {donutChart.segments.map((segment) => (
                            <circle
                              key={segment.extension}
                              cx="70"
                              cy="70"
                              r={donutChart.radius}
                              fill="none"
                              stroke={segment.stroke}
                              strokeWidth={donutChart.strokeWidth}
                              strokeLinecap={segment.dash > 0 ? "round" : "butt"}
                              strokeDasharray={`${segment.dash} ${donutChart.circumference - segment.dash}`}
                              strokeDashoffset={segment.offset}
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">All files</span>
                          <span className="mt-1 text-3xl font-semibold text-slate-900">{donutChart.total}</span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leading formats</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {donutChart.segments
                            .filter((segment) => segment.count > 0)
                            .slice(0, 3)
                            .map((segment) => (
                              <div
                                key={segment.extension}
                                className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase text-slate-700 shadow-sm"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: segment.stroke }}
                                />
                                {segment.extension}
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {donutChart.segments.map((item) => (
                      <FileTypeBar
                        key={item.extension}
                        extension={item.extension}
                        count={item.count}
                        percentage={item.percentage}
                        color={analyticsColors[item.extension as keyof typeof analyticsColors] || "#94a3b8"}
                      />
                    ))}
                  </div>
                </div>
              </aside>

              <aside className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">Upload trend insights</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">How uploads move over time</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(186,230,253,0.9),rgba(224,242,254,0.7),rgba(255,255,255,0.9))] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.uploadTrend.uploadedToday}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-[linear-gradient(135deg,rgba(221,214,254,0.92),rgba(237,233,254,0.72),rgba(255,255,255,0.9))] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">This week</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.uploadTrend.uploadedThisWeek}</p>
                  </div>
                  <div className="rounded-2xl border border-pink-100 bg-[linear-gradient(135deg,rgba(251,207,232,0.92),rgba(252,231,243,0.72),rgba(255,255,255,0.9))] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">This month</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.uploadTrend.uploadedThisMonth}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(187,247,208,0.9),rgba(220,252,231,0.72),rgba(255,255,255,0.9))] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Average / day</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.uploadTrend.averageUploadsPerDay}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(240,253,250,0.76),rgba(239,246,255,0.82))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last 7 days</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        Most uploads happen between <span className="font-semibold text-slate-900">{dashboard.uploadTrend.peakUploadHourLabel}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/80 bg-white/78 px-3 py-3">
                    <svg
                      viewBox={`0 0 ${uploadTrendChart.width} ${uploadTrendChart.height}`}
                      className="h-36 w-full"
                      preserveAspectRatio="none"
                    >
                      <path
                        d={uploadTrendChart.path}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {uploadTrendChart.points.map((point) => (
                        <g key={point.label}>
                          <circle cx={point.x} cy={point.y} r="4" fill="#10b981" />
                        </g>
                      ))}
                    </svg>
                    <div className="mt-2 grid grid-cols-7 gap-2 text-[11px] text-slate-500">
                      {dashboard.uploadTrend.dailySeries.map((item) => (
                        <span key={item.date} className="truncate text-center">
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              <aside className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">Storage consumption breakdown</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Where space is going</h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white/72 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Remaining capacity</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatStorageGb(dashboard.storageBreakdown.remainingCapacity)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{dashboard.storageBreakdown.usedPercentage}% used</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white/72 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Growth this week</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {formatSignedPercent(dashboard.storageBreakdown.growthRateThisWeek)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Compared with previous week</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,251,235,0.82),rgba(255,247,237,0.82))] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Folder share</p>
                  <div className="mt-3 grid gap-3">
                    {dashboard.storageBreakdown.topFolders.length ? (
                      dashboard.storageBreakdown.topFolders.map((folder, index) => (
                        <div key={folder.id} className="grid gap-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{folder.name}</p>
                              <p className="text-xs text-slate-500">
                                {folder.fileCount} files · {formatFileSize(folder.storageUsed)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{folder.percentage}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/90">
                            <div
                              className={
                                index === 0
                                  ? "h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                                  : index === 1
                                    ? "h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-500"
                                    : index === 2
                                      ? "h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500"
                                      : "h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                              }
                              style={{ width: `${Math.max(folder.percentage, folder.storageUsed > 0 ? 8 : 0)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No folder storage usage yet.</p>
                    )}
                  </div>
                </div>

                {dashboard.storageBreakdown.topFolders[0] ? (
                  <div className="mt-4 rounded-[24px] border border-slate-100 bg-white/74 px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">
                      {dashboard.storageBreakdown.topFolders[0].name} folder consumes{" "}
                      <span className="font-semibold text-slate-900">
                        {dashboard.storageBreakdown.topFolders[0].percentage}% storage
                      </span>
                    </p>
                  </div>
                ) : null}
              </aside>
          </section>

          <section className="rounded-[28px] border border-white/75 bg-white/78 p-5 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">Recent files</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Open a file quickly</h2>
              </div>
              <Link to="/manager" className="text-sm font-medium text-sky-700 hover:text-slate-900">
                Manager
              </Link>
            </div>

            <div className="mt-4 grid gap-2">
              {dashboard.recentFiles.length ? (
                dashboard.recentFiles.slice(0, 8).map((file) => (
                  <Link
                    key={file.id}
                    to={`/files/${file.id}`}
                    className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_90px_90px_150px] items-center gap-3 rounded-[18px] border border-slate-100 bg-white/88 px-4 py-3 text-sm transition hover:-translate-y-0.5"
                  >
                    <p className="truncate font-semibold text-slate-900">{file.name}</p>
                    <p className="truncate text-slate-500">{file.folderName}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-semibold text-slate-600">
                      {file.extension}
                    </span>
                    <span className="truncate text-slate-500">{formatFileSize(file.size)}</span>
                    <span className="truncate text-right text-xs text-slate-500">{formatDate(file.updatedAt)}</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
                  No files yet. Upload something to get started.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
