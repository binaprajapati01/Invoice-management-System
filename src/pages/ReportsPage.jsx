import { useEffect } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, PieChart, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { EmptyState, KpiCard, PageHeader } from "../components/ui.jsx";
import Skeleton from "../components/Skeleton.jsx";

export default function ReportsPage() {
  const { reports, loading, fetchReports } = useAppStore();

  useEffect(() => {
    fetchReports().catch((error) => toast.error(error.message));
  }, []);

  const growth = (reports?.revenueSeries || []).map((item, index, rows) => ({ ...item, growth: index && rows[index - 1].revenue ? Math.round(((item.revenue - rows[index - 1].revenue) / rows[index - 1].revenue) * 100) : 0 }));
  const paidRatio = reports?.kpis?.invoices ? Math.round((reports.kpis.paid / reports.kpis.invoices) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Reports and analytics"
        title="Business Intelligence"
        description="Revenue charts, paid versus unpaid invoices, growth, client trends, and performance analytics calculated from database records."
      />
      {loading.reports ? <Skeleton rows={5} /> : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={TrendingUp} label="Monthly growth" value={`${growth.at(-1)?.growth || 0}%`} trend="From paid invoice history" tone="emerald" />
            <KpiCard icon={BarChart3} label="Total invoices" value={reports?.kpis?.invoices || 0} trend="Live database count" tone="blue" />
            <KpiCard icon={PieChart} label="Paid ratio" value={`${paidRatio}%`} trend={`${reports?.kpis?.pending || 0} pending`} tone="purple" />
            <KpiCard icon={Activity} label="Clients" value={reports?.kpis?.clients || 0} trend="Active CRM base" tone="slate" />
          </section>
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Revenue and invoices" empty={!hasData(reports?.revenueSeries, "revenue")}>
              <AreaChart data={reports?.revenueSeries || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fill="#2563EB22" />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Monthly growth" empty={!hasData(growth, "growth")}>
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="growth" stroke="#7C3AED" strokeWidth={3} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Paid vs unpaid" empty={!hasData(reports?.statusSeries, "value")}>
              <BarChart data={reports?.statusSeries || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Manager performance" empty={!hasData(reports?.managerPerformance, "invoices")}>
              <BarChart data={reports?.managerPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="manager" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip />
                <Bar dataKey="invoices" fill="#2563EB" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ChartCard>
          </section>
        </>
      )}
    </>
  );
}

function ChartCard({ title, children, empty }) {
  return <div className="premium-card"><h2 className="text-lg font-bold">{title}</h2>{empty ? <EmptyState icon={BarChart3} title="No chart data yet" description="Create invoices and record payments to populate this report." /> : <div className="mt-5 h-80"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}</div>;
}

function hasData(rows = [], key) {
  return rows.some((row) => Number(row[key] || 0) !== 0);
}
