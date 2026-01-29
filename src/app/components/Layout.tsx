import { Outlet } from "react-router";
import { FileTreeNav } from "@/app/components/FileTreeNav";
import { OrganicBackground } from "@/app/components/OrganicBackground";

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <OrganicBackground />

      <div className="relative z-10 flex">
        <FileTreeNav />

        <main className="flex-1 h-screen overflow-y-auto overscroll-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
