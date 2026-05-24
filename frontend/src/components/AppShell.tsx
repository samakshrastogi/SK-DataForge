import { ReactNode } from "react";
import Topbar from "./Topbar";
import { clientEnv } from "../lib/env";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-2 py-2 text-slate-800 sm:px-3 md:px-4 md:py-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute right-[-5rem] top-24 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
      </div>
      <div className="relative z-10 flex w-full flex-col gap-4">
        <Topbar projectName={clientEnv.appName} />
        {children}
      </div>
    </main>
  );
}
