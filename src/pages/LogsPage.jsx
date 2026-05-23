import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Filter } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { PageHeader } from "../components/ui.jsx";
import Skeleton from "../components/Skeleton.jsx";

export default function LogsPage() {
  const { logs, loading, fetchLogs } = useAppStore();
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchLogs().catch((error) => toast.error(error.message));
  }, []);

  const filtered = useMemo(() => logs.filter((log) => [log.actor?.name, log.action, log.entity].join(" ").toLowerCase().includes(filter.toLowerCase())), [logs, filter]);

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="System Logs"
        description="Review user monitoring events, platform activity, security actions, invoice operations, and permission changes."
        action={<div className="relative"><Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="premium-input pl-11" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter logs" /></div>}
      />
      <div className="premium-card">
        {loading.logs ? <Skeleton /> : (
          <div className="space-y-3">
            {filtered.map((log) => (
              <div key={log._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><ClipboardList className="h-5 w-5" /></div>
                  <div><p className="font-bold">{log.action}</p><p className="text-sm text-slate-500">{log.actor?.name || "System"} • {log.entity}</p></div>
                </div>
                <span className="text-sm font-semibold text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {!filtered.length && <p className="py-12 text-center text-slate-500">No activity logs found.</p>}
          </div>
        )}
      </div>
    </>
  );
}
