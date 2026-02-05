import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { FileTreeNav } from "@/app/components/FileTreeNav";
import { OrganicBackground } from "@/app/components/OrganicBackground";
import { Menu } from "lucide-react";

export function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };

    if (mobileNavOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[#0a0e27] text-zinc-100 overflow-hidden">
      <OrganicBackground />

      <div className="relative z-10 flex">
        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] md:hidden"
            aria-label="Fermer le menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <FileTreeNav mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

        <main className="flex-1 h-screen overflow-y-auto overscroll-none">
          <div className="md:hidden sticky top-0 z-20 border-b border-zinc-800 bg-[#0a0e27]/80 backdrop-blur px-4 py-3">
            <button
              type="button"
              className="text-left w-full"
              onClick={() => navigate("/")}
              aria-label="Aller à la page d’accueil"
            >
              <div className="font-semibold text-zinc-100 leading-tight">Random Things</div>
            </button>

            <div className="mt-1 flex items-center justify-between text-sm text-zinc-500">
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                onClick={() => navigate("/")}
              >
                archives
              </button>

              <button
                type="button"
                aria-label="Ouvrir le menu"
                className="p-1.5 -mr-1 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/40 transition-colors"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
