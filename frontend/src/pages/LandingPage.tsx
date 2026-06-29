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

const audienceItems = [
  ["Ops teams", "Control intake folders, recurring imports, quota growth, and operational evidence in one place."],
  ["QA teams", "Find duplicates, inspect evidence files, compare table quality, and keep review trails searchable."],
  ["Data teams", "Preview CSV/XLSX files, understand row-level quality signals, and prepare clean downstream handoffs."],
  ["Audit teams", "Review ownership, retention, upload history, and file activity without chasing side-channel records."]
];

const trustDetails = [
  ["Storage policy", "Workspace quota, folder usage, largest files, and warning thresholds are visible before storage becomes a blocker."],
  ["Access control", "Authenticated users enter role-aware workflows for uploading, searching, previewing, and managing files."],
  ["Audit logging", "Mutation routes are wired through audit middleware so uploads, changes, and file operations can be reviewed."],
  ["Retention behavior", "Retention rules and cleanup policies help teams decide what stays active and what can be archived."]
];

const supportedData = ["CSV", "XLSX", "PDF", "TXT", "JSON", "LOG", "ZIP", "Images"];

const footerGroups = [
  {
    title: "Product",
    links: [
      ["Workspace overview", "#overview"],
      ["Capabilities", "#capabilities"],
      ["Who it is for", "#teams"],
      ["Governance", "#governance"]
    ]
  },
  {
    title: "Operations",
    links: [
      ["Upload control", "#capabilities"],
      ["File previews", "#capabilities"],
      ["Trust details", "#trust"],
      ["Audit trails", "#trust"]
    ]
  },
  {
    title: "Supported data",
    links: [
      ["CSV and XLSX", "#supported-data"],
      ["ZIP archives", "#supported-data"],
      ["Images and evidence", "#supported-data"]
    ]
  }
];

export default function LandingPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#fbfcff] text-slate-950">
      <section id="overview" className="w-full max-w-full border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f2fbff_38%,#fff7ed_74%,#f7f1ff_100%)] px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[20rem] min-w-0 flex-col overflow-hidden sm:max-w-7xl">
          <header className="flex w-[calc(100vw-2rem)] max-w-full min-w-0 items-center justify-between gap-3 py-4 sm:w-full sm:gap-4">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white shadow-sm">
                SK
              </span>
              <span className="truncate font-semibold text-slate-950">{clientEnv.appName}</span>
            </Link>
            <Link
              to="/login"
              className="hidden shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 sm:inline-flex"
            >
              Sign in
            </Link>
          </header>

          <div className="grid w-full max-w-full min-w-0 items-center gap-8 pb-8 pt-5 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
            <div className="w-full max-w-2xl min-w-0">
              <div className="inline-flex max-w-full whitespace-normal break-words rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase leading-5 tracking-wide text-emerald-700 sm:text-xs">
                File operations, previews, search, and governance
              </div>
              <h1 className="mt-4 max-w-2xl break-words text-4xl font-semibold leading-tight text-slate-950 lg:text-5xl">
                SK DataForge
              </h1>
              <p className="mt-4 max-w-xl break-words text-base leading-7 text-slate-700">
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
                    <p className="max-w-xl break-words text-sm leading-6 text-slate-600">{benefit.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex w-full justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 sm:w-auto"
                >
                  Open workspace
                </Link>
                <a
                  href="#capabilities"
                  className="inline-flex w-full justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 sm:w-auto"
                >
                  Explore capabilities
                </a>
              </div>
            </div>

            <div className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Real workspace screens</p>
                  <p className="text-xs text-slate-500">Captured from the authenticated DataForge app</p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-cyan-50 px-2 py-1 text-cyan-700">Dashboard</span>
                  <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-700">Manager</span>
                </div>
              </div>

              <div className="grid min-w-0 gap-3">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img
                    src="/screenshots/dashboard-overview.png"
                    alt="Authenticated SK DataForge dashboard showing quota, file types, uploads, storage, and recent files"
                    className="block aspect-[16/9] w-full min-w-0 object-cover object-top"
                  />
                </div>

                <div className="grid min-w-0 gap-3 md:grid-cols-[0.9fr_1.1fr]">
                  <img
                    src="/screenshots/file-manager.png"
                    alt="Authenticated SK DataForge file manager showing folders, duplicates, imports, and files"
                    className="block aspect-[16/10] w-full min-w-0 rounded-lg border border-slate-200 object-cover object-top"
                  />
                  <div className="grid content-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Live product evidence</p>
                    <p className="text-sm leading-6 text-amber-800">
                      These images come from the authenticated workspace: dashboard analytics, quota controls, file manager, duplicate checks, imports, and folder operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="teams" className="border-b border-slate-200 bg-[#fbfcff] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Who it is for</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Built for the teams that touch messy files every day</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              DataForge gives each team a practical view of the same workspace, so intake, quality, ownership, and audit follow-up stay connected.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {audienceItems.map((item, index) => (
              <div key={item[0]} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className={["bg-cyan-500", "bg-orange-500", "bg-violet-500", "bg-emerald-500"][index] + " mb-4 h-2 w-12 rounded-full"} />
                <h3 className="text-lg font-semibold text-slate-950">{item[0]}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item[1]}</p>
              </div>
            ))}
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

      <section id="trust" className="border-b border-slate-200 bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Trust and security</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Controls that make file operations accountable</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The page now surfaces the operational safeguards that matter most: storage policy, access control, audit visibility, and retention behavior.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {trustDetails.map((detail, index) => (
              <div key={detail[0]} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <span className={["bg-cyan-100 text-cyan-700", "bg-orange-100 text-orange-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700"][index] + " rounded-md px-2.5 py-1 text-xs font-semibold"}>
                  {detail[0]}
                </span>
                <p className="mt-4 text-sm leading-6 text-slate-700">{detail[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="governance" className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_100%)] px-4 py-16 sm:px-6">
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

      <section id="supported-data" className="border-t border-slate-200 bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Supported data</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Ready for the file types teams actually exchange</h2>
          </div>
          <div className="flex max-w-2xl flex-wrap gap-2">
            {supportedData.map((item) => (
              <span key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_48%,#0e7490_100%)] px-4 py-16 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-200">Bring the workspace online</p>
            <h2 className="mt-3 text-3xl font-semibold">Start from upload control, then build toward searchable governance.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Open the workspace to review folders, quota, upload activity, duplicate checks, file previews, and audit-ready operations.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_36px_rgba(255,255,255,0.16)] transition hover:bg-cyan-100 sm:w-auto"
          >
            Open workspace
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 px-4 py-12 text-white sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_1.4fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-950">
                SK
              </span>
              <span className="font-semibold">{clientEnv.appName}</span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              A governed file workspace for teams that need controlled uploads, searchable previews, table intelligence, quota visibility, and retention accountability.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md bg-cyan-400/15 px-2.5 py-1.5 text-cyan-200">Secure intake</span>
              <span className="rounded-md bg-orange-400/15 px-2.5 py-1.5 text-orange-200">Quality checks</span>
              <span className="rounded-md bg-violet-400/15 px-2.5 py-1.5 text-violet-200">Audit ready</span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                <div className="mt-3 grid gap-2">
                  {group.links.map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      className="text-sm text-slate-300 transition hover:text-cyan-200"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>Built for controlled data operations, previews, search, and governance.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>© 2026 {clientEnv.appName}</span>
            <Link
              to="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
