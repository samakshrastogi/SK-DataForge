import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@sk-dataforge.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 text-slate-800">
      <section className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] text-sm font-bold text-white">
            SK
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-950">SK DataForge</p>
            <p className="text-sm text-slate-500">Sign in to your workspace</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              autoComplete="email"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1,#ec4899)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(99,102,241,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
