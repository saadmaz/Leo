import { ReactNode } from "react";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { ProductContext } from "@/types";

interface AppShellProps {
  children: ReactNode;
  sidebar: {
    sessionCost: number;
    queryCost: number;
    hasMessages: boolean;
  };
  topbar: {
    product: ProductContext;
    onUpdate: (product: ProductContext) => void;
    isProcessing: boolean;
    useMock: boolean;
  };
  composer: ReactNode;
}

export default function AppShell({ children, sidebar, topbar, composer }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_24%),linear-gradient(180deg,#020617_0%,#020817_38%,#030712_100%)] text-slate-100">
      <Sidebar {...sidebar} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar {...topbar} />
        <main className="flex-1 px-4 pb-40 pt-6 sm:px-6 lg:px-8">{children}</main>
        {composer}
      </div>
    </div>
  );
}
