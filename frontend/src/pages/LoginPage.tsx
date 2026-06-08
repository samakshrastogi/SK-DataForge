import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { clientEnv } from "../lib/env";

type AuthMode = "login" | "register" | "forgot" | "reset";

const modeLabels: Array<{ mode: AuthMode; label: string }> = [
  { mode: "login", label: "Login" },
  { mode: "register", label: "Register" },
  { mode: "forgot", label: "Forgot" },
  { mode: "reset", label: "Reset" }
];

const modeContent: Record<AuthMode, { title: string; hint: string; action: string }> = {
  login: {
    title: "Welcome back",
    hint: "Access your secure data workspace.",
    action: "Login"
  },
  register: {
    title: "Create your account",
    hint: "Start with viewer access and request elevated roles when needed.",
    action: "Create account"
  },
  forgot: {
    title: "Recover access",
    hint: "Request a reset token for your workspace account.",
    action: "Send reset"
  },
  reset: {
    title: "Set a new password",
    hint: "Enter your reset token and choose a new password.",
    action: "Reset password"
  }
};

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.35 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.16.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@sk-dataforge.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (!clientEnv.googleClientId || !googleButtonRef.current) {
      return;
    }

    const handleGoogleCredential = async (credential: string) => {
      try {
        setSubmitting(true);
        setError("");
        const response = await fetch(`${clientEnv.apiUrl}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential })
        });
        const data = (await response.json()) as { token: string; user: unknown; message?: string };

        if (!response.ok) {
          throw new Error(data.message || "Google sign-in failed.");
        }

        localStorage.setItem("sk-dataforge-auth-token", data.token);
        window.location.assign(redirectTo);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Google sign-in failed.");
      } finally {
        setSubmitting(false);
      }
    };

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) {
        return false;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientEnv.googleClientId,
        callback: (response) => {
          if (response.credential) {
            void handleGoogleCredential(response.credential);
          }
        }
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: "320",
        text: "signin_with"
      });
      return true;
    };

    if (renderGoogleButton()) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [redirectTo]);

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const postAuth = async (path: string, body: Record<string, string>) => {
    const response = await fetch(`${clientEnv.apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as { token?: string; message?: string; resetToken?: string };

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      if (mode === "login") {
        await login(email, password);
        navigate(redirectTo, { replace: true });
        return;
      }

      if (mode === "register") {
        const data = await postAuth("/auth/register", { name, email, password });
        if (data.token) {
          localStorage.setItem("sk-dataforge-auth-token", data.token);
          window.location.assign(redirectTo);
        }
        return;
      }

      if (mode === "forgot") {
        const data = await postAuth("/auth/forgot-password", { email });
        setMessage(data.resetToken ? `${data.message} Dev token: ${data.resetToken}` : data.message || "Reset requested.");
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setMode("reset");
        }
        return;
      }

      const data = await postAuth("/auth/reset-password", { token: resetToken, password });
      setMessage(data.message || "Password updated. You can log in now.");
      setMode("login");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentMode = modeContent[mode];

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#e0f2fe_0%,#eef2ff_36%,#fff1f2_70%,#fffbeb_100%)] px-3 py-4 text-slate-800 sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/52 shadow-[0_30px_90px_rgba(30,41,59,0.18)] backdrop-blur-xl lg:grid-cols-[1.04fr_0.96fr]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_43%,#0e7490_100%)] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)]">
                SK
              </div>
              <div>
                <p className="text-lg font-semibold">{clientEnv.appName}</p>
                <p className="text-sm text-cyan-100">Secure file intelligence</p>
              </div>
            </div>

            <div className="mt-12 max-w-md">
              <p className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100 backdrop-blur">
                Data workspace access
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight">
                Govern uploads, previews, search, and retention from one workspace.
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-200">
                Built for teams that need file operations with duplicate checks, quota controls, audit trails, and table insights.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-10 grid gap-3">
            <div className="rounded-2xl border border-white/14 bg-white/12 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.20)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Workspace health</span>
                <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-950">Active</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Files", "1.2k"],
                  ["Indexed", "98%"],
                  ["Quota", "64%"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/12 px-3 py-3">
                    <p className="text-xs text-cyan-100">{label}</p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur">
              <div>
                <p className="text-sm font-semibold">Latest table profile</p>
                <p className="mt-1 text-xs text-slate-300">Missing cells, duplicate rows, trends</p>
              </div>
              <div className="grid h-14 w-20 content-end gap-1">
                <span className="h-5 rounded bg-cyan-300" />
                <span className="h-8 rounded bg-fuchsia-300" />
                <span className="h-11 rounded bg-amber-300" />
              </div>
            </div>
          </div>
        </aside>

        <div className="grid content-center p-4 sm:p-8">
          <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_24px_70px_rgba(30,41,59,0.16)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-slate-950">{currentMode.title}</p>
                <p className="mt-1 text-sm text-slate-500">{currentMode.hint}</p>
              </div>
              <Link
                to="/"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-slate-950"
              >
                Home
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-4 rounded-2xl border border-white bg-slate-100/80 p-1 shadow-inner">
              {modeLabels.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => {
                    setMode(item.mode);
                    setError("");
                    setMessage("");
                  }}
                  className={`h-10 rounded-xl text-xs font-semibold transition ${
                    mode === item.mode
                      ? "bg-[linear-gradient(135deg,#06b6d4,#6366f1,#ec4899)] text-white shadow-[0_12px_26px_rgba(99,102,241,0.24)]"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-3">
              {mode === "register" ? (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Name
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    autoComplete="name"
                    required
                  />
                </label>
              ) : null}

              {mode !== "reset" ? (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    autoComplete="email"
                    required
                  />
                </label>
              ) : (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Reset token
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    required
                  />
                </label>
              )}

              {mode !== "forgot" ? (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  {mode === "reset" ? "New password" : "Password"}
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                </label>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 h-12 rounded-2xl bg-[linear-gradient(135deg,#06b6d4,#6366f1,#ec4899)] px-4 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(99,102,241,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(236,72,153,0.26)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Working..." : currentMode.action}
              </button>
            </form>

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              {clientEnv.googleClientId ? (
                <div ref={googleButtonRef} className="flex justify-center" />
              ) : (
                <button
                  type="button"
                  onClick={() => setError("Google SSO is not configured. Add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID.")}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                >
                  <GoogleLogo />
                  Continue with Google
                </button>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
