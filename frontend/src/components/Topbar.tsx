import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clientEnv } from "../lib/env";

type IconButtonProps = {
  label: string;
  badge?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

function IconButton({ label, badge, children, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:text-slate-900"
    >
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {children}
    </button>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

type TopbarProps = {
  projectName: string;
};

type NotificationsResponse = {
  unreadCount: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }>;
};

type WorkspaceResponse = {
  name: string;
  adminLabel: string;
  quotaBytes: number;
  usedBytes: number;
  usedPercentage: number;
  remainingBytes: number;
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Topbar({ projectName }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (location.pathname === "/search") {
      setSearchOpen(true);
      const currentQuery = new URLSearchParams(location.search).get("q") || "";
      setQuery(currentQuery);
      return;
    }

    setQuery("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    const loadTopbarData = async () => {
      try {
        const [notificationsResponse, workspaceResponse] = await Promise.all([
          fetch(`${clientEnv.apiUrl}/notifications`),
          fetch(`${clientEnv.apiUrl}/workspace`)
        ]);
        const notificationsData = (await notificationsResponse.json()) as NotificationsResponse;
        const workspaceData = (await workspaceResponse.json()) as WorkspaceResponse;

        if (notificationsResponse.ok) {
          setNotifications(notificationsData);
        }

        if (workspaceResponse.ok) {
          setWorkspace(workspaceData);
        }
      } catch {
        return;
      }
    };

    void loadTopbarData();
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }

      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();

    if (!nextQuery) {
      navigate("/search");
      return;
    }

    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  };

  const markNotificationsRead = async () => {
    await fetch(`${clientEnv.apiUrl}/notifications/read-all`, { method: "POST" });
    setNotifications((current) =>
      current
        ? {
            ...current,
            unreadCount: 0,
            items: current.items.map((item) => ({ ...item, read: true }))
          }
        : current
    );
  };

  return (
    <header className="sticky top-2 z-20 w-full rounded-[24px] border border-white/70 bg-white/78 px-3 py-3 shadow-[0_18px_50px_rgba(99,102,241,0.10)] backdrop-blur md:px-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] text-sm font-bold text-white shadow-[0_12px_30px_rgba(99,102,241,0.28)]">
            SK
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 md:text-lg">
              {projectName}
            </p>
            <p className="truncate text-xs text-slate-500">
              Upload, organize, and manage table files in one place
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          <div className="hidden items-center gap-1.5 sm:flex">
            <Link
              to="/"
              aria-label="Home"
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                location.pathname === "/"
                  ? "bg-[linear-gradient(135deg,#0ea5e9,#6366f1)] text-white shadow-[0_10px_24px_rgba(99,102,241,0.22)]"
                  : "border border-white/80 bg-white/75 text-slate-700 hover:border-sky-200 hover:bg-white"
              }`}
            >
              <HomeIcon />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div
              ref={searchContainerRef}
              onMouseEnter={() => setSearchOpen(true)}
              onMouseLeave={() => {
                if (document.activeElement !== searchInputRef.current) {
                  setSearchOpen(false);
                }
              }}
              className={`group flex h-10 items-center overflow-hidden rounded-xl border bg-white/88 shadow-sm backdrop-blur transition-all duration-200 ${
                searchOpen
                  ? "w-[min(18rem,78vw)] border-sky-200"
                  : "w-10 border-white/70 hover:border-sky-200"
              }`}
            >
              <button
                type="button"
                aria-label="Open global search"
                onClick={() => setSearchOpen((current) => !current)}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-700 transition hover:text-slate-900"
              >
                <SearchIcon />
              </button>
              <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (
                        searchContainerRef.current &&
                        !searchContainerRef.current.contains(document.activeElement)
                      ) {
                        setSearchOpen(false);
                      }
                    }, 0);
                  }}
                  placeholder="Search folders, files, content..."
                  className={`min-w-0 flex-1 bg-transparent pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition ${
                    searchOpen ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                />
              </form>
            </div>
            <div ref={notificationsRef} className="relative">
              <IconButton
                label="Notifications"
                badge={notifications?.unreadCount ? String(notifications.unreadCount) : undefined}
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                  if ((notifications?.unreadCount || 0) > 0) {
                    void markNotificationsRead();
                  }
                }}
              >
                <BellIcon />
              </IconButton>
              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-30 w-[min(26rem,88vw)] rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
                        Notifications
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Real workspace events
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {notifications?.items.length || 0}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {notifications?.items.length ? (
                      notifications.items.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-2xl border px-3 py-3 ${
                            item.read
                              ? "border-slate-100 bg-slate-50/80"
                              : "border-sky-100 bg-sky-50/80"
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div ref={profileRef} className="relative">
              <IconButton
                label="Profile"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
              >
                <ProfileIcon />
              </IconButton>
              {profileOpen ? (
                <div className="absolute right-0 top-12 z-30 w-[min(22rem,88vw)] rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-500">
                    Workspace
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    {workspace?.name || projectName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {workspace?.adminLabel || "Workspace Admin"}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Storage used
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatFileSize(workspace?.usedBytes || 0)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {workspace?.usedPercentage || 0}% of {formatFileSize(workspace?.quotaBytes || 0)}
                      </p>
                    </div>
                    <Link
                      to="/"
                      className="rounded-xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] px-4 py-3 text-center text-sm font-semibold text-white"
                    >
                      Open quota controls
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
