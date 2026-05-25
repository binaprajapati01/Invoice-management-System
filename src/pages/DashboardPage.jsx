import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, ClipboardCheck, FileText, TrendingUp, UsersRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../state/AuthContext.jsx";
import { useAppStore } from "../store/appStore.js";
import { formatMoney } from "../lib/invoice.js";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "../components/ui.jsx";
import Skeleton from "../components/Skeleton.jsx";

export default function DashboardPage() {
  const { user } = useAuth();
  const { reports, invoices, users, logs, loading, fetchReports, fetchInvoices, fetchUsers, fetchLogs } = useAppStore();
  const role = user?.role || "Manager";

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([
          fetchReports(),
          fetchInvoices(),
          ["Super Admin", "Admin"].includes(role) ? fetchUsers() : Promise.resolve(),
          ["Super Admin", "Admin"].includes(role) ? fetchLogs().catch(() => []) : Promise.resolve()
        ]);
      } catch (error) {
        toast.error(error.message);
      }
    }
    load();
  }, [role]);

  const kpis = reports?.kpis || {};
  const roleDescription = {
    "Super Admin": "Monitor platform-wide growth, admin activity, permissions, revenue, and system health from one control plane.",
    Admin: "Manage managers, clients, templates, invoice operations, and monthly reporting with clean operational visibility.",
    Manager: "Create invoices, follow payments, manage clients, and keep billing moving without leaving the dashboard."
  };

  return (
    <>
      <PageHeader
        eyebrow={`${role} workspace`}
        title={`Good morning, ${user?.name?.split(" ")[0] || "there"}`}
        description={roleDescription[role]}
        action={<Link className="premium-btn" to="/invoices/new">Create invoice</Link>}
      />

      {loading.reports ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {role === "Super Admin" ? (
              <>
                <KpiCard icon={UsersRound} label="Total admins" value={kpis.totalAdmins || 0} trend="From user records" tone="blue" />
                <KpiCard icon={UsersRound} label="Total managers" value={kpis.totalManagers || 0} trend="From user records" tone="emerald" />
                <KpiCard icon={FileText} label="Total invoices" value={kpis.invoices || 0} trend="Across the platform" tone="purple" />
                <KpiCard icon={Banknote} label="Total revenue" value={formatMoney(kpis.revenue || 0)} trend="Paid invoices only" tone="slate" />
              </>
            ) : role === "Admin" ? (
              <>
                <KpiCard icon={UsersRound} label="Managers" value={kpis.totalManagers || 0} trend="Team accounts" tone="blue" />
                <KpiCard icon={UsersRound} label="Clients" value={kpis.clients || 0} trend="Client collection" tone="emerald" />
                <KpiCard icon={FileText} label="Invoices monitored" value={kpis.invoices || 0} trend={`${kpis.pending || 0} require action`} tone="purple" />
                <KpiCard icon={Banknote} label="Revenue" value={formatMoney(kpis.revenue || 0)} trend="Paid invoices only" tone="slate" />
              </>
            ) : (
              <>
                <KpiCard icon={FileText} label="My invoices" value={kpis.invoices || 0} trend="Created by you" tone="blue" />
                <KpiCard icon={ClipboardCheck} label="Paid" value={kpis.paid || 0} trend="Collected invoices" tone="emerald" />
                <KpiCard icon={FileText} label="Unpaid" value={kpis.unpaid || 0} trend="Sent or pending" tone="purple" />
                <KpiCard icon={Banknote} label="Revenue" value={formatMoney(kpis.revenue || 0)} trend="Your paid invoices" tone="slate" />
              </>
            )}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
            <div className="premium-card">
              <ChartHeader title="Revenue analytics" description="Revenue is calculated only from paid invoices" />
              {hasChartData(reports?.revenueSeries, "revenue") ? (
                <div className="mt-6 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reports.revenueSeries}>
                      <defs><linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" stroke="#94A3B8" />
                      <YAxis stroke="#94A3B8" />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fill="url(#revenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState icon={TrendingUp} title="No paid revenue yet" description="Create invoices and record successful payments to populate this chart." />}
            </div>

            <div className="premium-card">
              <ChartHeader title="Invoice status" description="Paid, pending, draft, and overdue status from invoices" />
              {hasChartData(reports?.statusSeries, "value") ? (
                <>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={reports.statusSeries} dataKey="value" innerRadius={66} outerRadius={105} paddingAngle={4}>
                          {reports.statusSeries.map((entry, index) => <Cell key={entry.name} fill={["#10B981", "#2563EB", "#F97316", "#94A3B8"][index % 4]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {reports.statusSeries.map((item) => <div key={item.name} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><b>{item.value}</b><p className="text-slate-500">{item.name}</p></div>)}
                  </div>
                </>
              ) : <EmptyState icon={FileText} title="No invoices yet" description="Invoice status analytics appear after invoices are created." />}
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="premium-card overflow-hidden">
              <h2 className="text-lg font-bold">{role === "Manager" ? "Recent invoices" : "User monitoring"}</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="premium-table min-w-[560px]">
                  <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3">Name</th><th>Role/Client</th><th>Status</th><th>Activity</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(role === "Manager" ? invoices : users).slice(0, 6).map((item) => (
                      <tr key={item._id}>
                        <td className="py-4 font-bold">{item.name || item.invoiceNumber}</td>
                        <td className="text-slate-500">{item.role || item.clientSnapshot?.name}</td>
                        <td><StatusBadge status={item.status || (item.isActive ? "Active" : "Inactive")} /></td>
                        <td className="text-slate-500">{item.email || formatMoney(item.total, item.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="premium-card">
              <h2 className="text-lg font-bold">Manager performance</h2>
              <p className="text-sm text-slate-500">Created invoices and paid revenue by manager</p>
              {hasChartData(reports?.managerPerformance, "invoices") ? (
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports.managerPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="manager" stroke="#94A3B8" />
                      <YAxis stroke="#94A3B8" />
                      <Tooltip />
                      <Bar dataKey="invoices" radius={[12, 12, 0, 0]} fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState icon={UsersRound} title="No manager activity" description="Manager performance appears after managers create invoices." />}
            </div>
          </section>

          {["Super Admin", "Admin"].includes(role) && (
            <section className="mt-5 premium-card">
              <h2 className="text-lg font-bold">Recent activity</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {logs.slice(0, 8).map((log) => (
                  <div key={log._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-sm font-bold">{log.actor?.name || "System"}</p>
                    <p className="mt-1 text-sm text-slate-500">{log.action}</p>
                    <p className="mt-3 text-xs font-semibold text-blue-600">{log.entity} • {new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {!logs.length && <EmptyState icon={ClipboardCheck} title="No activity yet" description="Audit events appear here after users perform actions." />}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function ChartHeader({ title, description }) {
  return <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">{description}</p></div><TrendingUp className="h-6 w-6 text-blue-600" /></div>;
}

function hasChartData(rows = [], key) {
  return rows.some((row) => Number(row[key] || 0) > 0);
}
