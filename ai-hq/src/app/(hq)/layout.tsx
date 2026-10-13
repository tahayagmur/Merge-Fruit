import type { ReactNode } from "react";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function HqLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContent />
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="hq-grid pointer-events-none absolute inset-x-0 top-0 h-[28rem]" aria-hidden />
        <Topbar />
        <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
