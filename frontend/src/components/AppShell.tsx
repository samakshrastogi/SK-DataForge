import { ReactNode } from "react";
import Topbar from "./Topbar";
import { clientEnv } from "../lib/env";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-2 py-2 text-slate-800 sm:px-3">
      <div className="relative z-10 flex w-full flex-col gap-3">
        <Topbar projectName={clientEnv.appName} />
        {children}
      </div>
    </main>
  );
}
