import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Sidebar mobileOpen={mobileNavOpen} collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} onClose={() => setMobileNavOpen(false)} />
      <div className={`min-w-0 flex-1 transition-all ${collapsed ? "lg:pl-24" : "lg:pl-[260px]"}`}>
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
