import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Filter, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { CustomSelect, PageHeader } from "../components/ui.jsx";
import Skeleton from "../components/Skeleton.jsx";
import { useAuth } from "../state/AuthContext.jsx";

export default function LogsPage() {
  const { user } = useAuth();
  const { logs, users, loading, fetchLogs, fetchUsers } = useAppStore();
  const [actionQuery, setActionQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("All");
  const canFilterUsers = ["Super Admin", "Admin"].includes(user?.role);

  useEffect(() => {
    fetchLogs({ userId: selectedUser === "All" ? undefined : selectedUser, action: actionQuery || undefined }).catch((error) => toast.error(error.message));
  }, [actionQuery, fetchLogs, selectedUser]);

  useEffect(() => {
    if (canFilterUsers) fetchUsers().catch((error) => toast.error(error.message));
  }, [canFilterUsers, fetchUsers]);

  const userOptions = useMemo(() => [
    { label: "All users", value: "All" },
    ...users.map((item) => ({ label: `${item.name} (${item.role})`, value: item._id }))
  ], [users]);

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="System Logs"
        description="Review user monitoring events, platform activity, security actions, invoice operations, and permission changes."
        action={<div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[520px] md:flex-row">
          {canFilterUsers && <div className="md:w-64"><CustomSelect value={selectedUser} onChange={setSelectedUser} options={userOptions} /></div>}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="premium-input pl-11" value={actionQuery} onChange={(event) => setActionQuery(event.target.value)} placeholder="Search action keyword" />
          </div>
        </div>}
      />
      <div className="premium-card">
        {loading.logs ? <Skeleton /> : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Filter className="h-4 w-4" />
              <span>{logs.length} matching log{logs.length === 1 ? "" : "s"}</span>
            </div>
            {logs.map((log) => (
              <div key={log._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><ClipboardList className="h-5 w-5" /></div>
                  <div><p className="font-bold">{log.action}</p><p className="text-sm text-slate-500">{log.actor?.name || "System"} • {log.entity}</p></div>
                </div>
                <span className="text-sm font-semibold text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {!logs.length && <p className="py-12 text-center text-slate-500">No activity logs found.</p>}
          </div>
        )}
      </div>
    </>
  );
}
