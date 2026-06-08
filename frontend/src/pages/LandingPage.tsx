import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { clientEnv } from "../lib/env";

const benefits = [
  {
    label: "Centralized intake",
    value: "Bring CSV, XLSX, ZIP, images, logs, and audit exports into a governed folder structure."
  },
  {
    label: "Useful previews",
    value: "Inspect tables, file metadata, duplicate hints, and ownership before the file moves downstream."
  },
  {
    label: "Operational control",
    value: "Apply quota, retention, notifications, audit history, and role-based access from one workspace."
  }
];

const qualityMetrics = [
  ["Rows", "18.6k", "42 tables"],
  ["Duplicates", "31", "across uploads"],
  ["Missing", "1.8%", "by column"],
  ["Policies", "9", "active"]
];

const workflowSteps = [
  ["1", "Upload and classify", "Drop mixed folders, preserve source names, and tag files by team, month, and purpose."],
  ["2", "Inspect quality", "Open previews, compare row counts, review missing values, and flag duplicate files before sharing."],
  ["3", "Govern usage", "Track quota, retention, owners, notifications, and audit events without spreadsheet side logs."]
];

const governanceItems = [
  "Folder-level ownership and upload accountability",
  "Searchable previews for CSV, XLSX, images, ZIP files, and documents",
  "Retention and cleanup policies for stale operational data",
  "Audit history for uploads, downloads, previews, and deletions",
  "Workspace quota visibility before teams run out of storage",
  "Notifications for imports, policy changes, and file activity"
];

export default function LandingPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcff] text-slate-950">
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbff_38%,#fff7ed_74%,#f7f1ff_100%)] px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col">
          <header className="flex items-center justify-between gap-4 py-4">
            <Link to="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white shadow-sm">
                SK
              </span>
              <span className="font-semibold text-slate-950">{clientEnv.appName}</span>
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
            >
              Sign in
            </Link>
          </header>

          <div className="grid items-center gap-8 pb-8 pt-5 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                File operations, previews, search, and governance
              </div>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-slate-950 lg:text-5xl">
                SK DataForge
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-700">
                A secure workspace for teams that upload, organize, inspect, and govern data-heavy files without losing control of versions, duplicates, quota, or retention.
              </p>

              <div className="mt-6 grid gap-2">
                {benefits.map((benefit, index) => (
                  <div
                    key={benefit.label}
                    className="grid gap-1 border-l-4 bg-white/70 py-1.5 pl-4"
                    style={{ borderColor: ["#06b6d4", "#f97316", "#8b5cf6"][index] }}
                  >
                    <p className="text-sm font-semibold text-slate-950">{benefit.label}</p>
                    <p className="max-w-xl text-sm leading-6 text-slate-600">{benefit.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
                >
                  Open workspace
                </Link>
                <a
                  href="#capabilities"
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                >
                  Explore capabilities
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Workspace overview</p>
                  <p className="text-xs text-slate-500">Live data operations</p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-cyan-50 px-2 py-1 text-cyan-700">CSV</span>
                  <span className="rounded-md bg-orange-50 px-2 py-1 text-orange-700">XLSX</span>
                  <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-700">ZIP</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">IMG</span>
                </div>
              </div>

              <div className="grid gap-3 p-3 lg:grid-cols-[0.94fr_1.06fr]">
                <div className="grid content-start gap-3">
                  {[
                    ["Vendor feeds", "12 files", "84%", "bg-cyan-500"],
                    ["Audit exports", "19 files", "67%", "bg-orange-500"],
                    ["Monthly reports", "26 files", "92%", "bg-violet-500"],
                    ["Images and evidence", "33 files", "58%", "bg-emerald-500"]
                  ].map((folder) => (
                    <div key={folder[0]} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-950">{folder[0]}</span>
                        <span className="text-xs text-slate-500">{folder[1]}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div className={`h-full rounded-full ${folder[3]}`} style={{ width: folder[2] }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid content-start gap-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {qualityMetrics.map((metric, index) => (
                      <div
                        key={metric[0]}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <p className="text-xs text-slate-500">{metric[0]}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{metric[1]}</p>
                        <p className={["text-cyan-700", "text-orange-700", "text-violet-700", "text-emerald-700"][index] + " mt-1 text-[11px] font-medium"}>
                          {metric[2]}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="grid grid-cols-[1fr_92px_78px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      <span>File</span>
                      <span>Status</span>
                      <span>Owner</span>
                    </div>
                    {[
                      ["forecast-q2.xlsx", "Ready", "Ops"],
                      ["incident-log.csv", "Indexed", "QA"],
                      ["archive-bundle.zip", "Stored", "Data"],
                      ["site-photos.zip", "Preview", "Field"]
                    ].map((row) => (
                      <div key={row[0]} className="grid grid-cols-[1fr_92px_78px] border-b border-slate-100 px-3 py-2.5 text-xs text-slate-600 last:border-b-0">
                        <span className="truncate font-semibold text-slate-900">{row[0]}</span>
                        <span>{row[1]}</span>
                        <span>{row[2]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-900">Quota forecast</p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-amber-700">78% used</span>
                    </div>
                    <p className="text-xs leading-5 text-amber-800">
                      Current upload pace reaches the workspace limit in 18 days. Archive rules can recover 21.4 GB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-b border-slate-200 bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">What teams get</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Practical controls for messy operational files</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              DataForge is built around the daily work of upload-heavy teams: keeping source material findable, checking file quality early, and proving who changed what later.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step[0]} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <span className={["bg-cyan-100 text-cyan-700", "bg-orange-100 text-orange-700", "bg-violet-100 text-violet-700"][index] + " inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"}>
                  {step[0]}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{step[1]}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step[2]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_100%)] px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Governance coverage</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Keep files useful after upload</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The workspace tracks context that is usually scattered across chats, spreadsheets, and local folders, so teams can search, preview, retain, and clean up files with confidence.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {governanceItems.map((item, index) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className={["bg-cyan-500", "bg-orange-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-indigo-500"][index] + " mb-3 h-2 w-12 rounded-full"} />
                <p className="text-sm font-semibold leading-6 text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
