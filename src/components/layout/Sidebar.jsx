import { NavLink } from "react-router-dom";
import { BarChart3, Building2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, FileClock, FilePlus2, Files, LayoutDashboard, LockKeyhole, Settings, ShieldCheck, UserCog, UsersRound, X } from "lucide-react";
import { useAuth } from "../../state/AuthContext.jsx";

const roleNav = {
  "Super Admin": [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Admin Management", "/admins", UserCog],
    ["User Permissions", "/permissions", LockKeyhole],
    ["Analytics", "/analytics", BarChart3],
    ["System Logs", "/logs", ClipboardList],
    ["Settings", "/settings", Settings],
    ["Profile", "/profile", ShieldCheck]
  ],
  Admin: [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Manager Management", "/managers", UsersRound],
    ["Invoices", "/invoices", Files],
    ["Clients", "/clients", Building2],
    ["Templates", "/templates", FileClock],
    ["Reports", "/reports", BarChart3],
    ["Settings", "/settings", Settings]
  ],
  Manager: [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Create Invoice", "/invoices/new", FilePlus2],
    ["Invoice History", "/invoices", Files],
    ["Clients", "/clients", Building2],
    ["Payments", "/payments", CreditCard],
    ["Profile", "/profile", ShieldCheck]
  ]
};

export default function Sidebar({ mobileOpen = false, collapsed = false, onToggleCollapse, onClose }) {
  const { user } = useAuth();
  const links = roleNav[roleNavKey(user?.role)] || roleNav.Manager;

  return (
    <>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={onClose} aria-label="Close navigation overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-40 border-r border-slate-200/70 bg-white/95 px-4 py-5 shadow-soft backdrop-blur-2xl transition-all dark:border-slate-800 dark:bg-slate-950/95 lg:translate-x-0 ${collapsed ? "lg:w-24" : "lg:w-[260px]"} ${mobileOpen ? "w-[260px] translate-x-0" : "w-[260px] -translate-x-full"}`}>
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-glow">WC</div>
        <div className={collapsed ? "lg:hidden" : ""}>
          <p className="text-base font-extrabold tracking-tight">Web Cultivation</p>
          <p className="text-xs font-medium text-slate-500">Enterprise billing OS</p>
        </div>
        <button className="ml-auto grid h-10 w-10 place-items-center rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 lg:hidden" onClick={onClose} aria-label="Close navigation"><X className="h-5 w-5" /></button>
      </div>

      <div className={`mt-8 rounded-2xl bg-slate-950 p-4 text-white shadow-soft ${collapsed ? "lg:hidden" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Active Role</p>
        <p className="mt-2 text-lg font-bold">{user?.role}</p>
        <p className="mt-1 text-xs text-slate-300">{user?.email}</p>
      </div>

      <nav className="mt-6 space-y-1.5">
        {links.map(([label, to, Icon]) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-glow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="secondary-btn absolute bottom-5 left-4 right-4 hidden px-3 lg:flex" onClick={onToggleCollapse}>
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        <span className={collapsed ? "hidden" : ""}>Collapse</span>
      </button>
      </aside>
    </>
  );
}

function roleNavKey(role = "") {
  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "super admin" || normalized === "superadmin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  return "Manager";
}
