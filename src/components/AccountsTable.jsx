import { Trash2, UserCog } from "lucide-react";
import PermissionToggle from "./PermissionToggle.jsx";
import { StatusBadge } from "./ui.jsx";

export default function AccountsTable({
  accounts,
  filteredCount,
  page,
  pageCount,
  sort,
  setSort,
  onEdit,
  onDelete,
  onPermissionToggle,
  onPreviousPage,
  onNextPage
}) {
  if (!filteredCount) {
    return <div className="px-5 py-10 text-center text-slate-500">No accounts found.</div>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="premium-table min-w-[760px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <Sortable label="User" sortKey="name" sort={sort} setSort={setSort} />
              <Sortable label="Role" sortKey="role" sort={sort} setSort={setSort} />
              <th>Status</th>
              <th>Permissions</th>
              <Sortable label="Last login" sortKey="lastLogin" sort={sort} setSort={setSort} />
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.map((user) => (
              <tr key={user._id}>
                <td className="px-5 py-4">
                  <UserIdentity user={user} />
                </td>
                <td>{user.role}</td>
                <td><StatusBadge status={user.isActive ? "Active" : "Inactive"} /></td>
                <td>
                  <PermissionToggle
                    userId={user._id}
                    initialEnabled={user.hasAccess}
                    onToggle={onPermissionToggle}
                  />
                </td>
                <td className="text-slate-500">{formatLastLogin(user.lastLogin)}</td>
                <td className="pr-5">
                  <AccountActions user={user} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {accounts.map((user) => (
          <article key={user._id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <UserAvatar name={user.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <StatusBadge status={user.isActive ? "Active" : "Inactive"} />
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
              <MobileRow label="Role" value={user.role} />
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Permissions</span>
                <PermissionToggle
                  userId={user._id}
                  initialEnabled={user.hasAccess}
                  onToggle={onPermissionToggle}
                />
              </div>
              <MobileRow label="Last login" value={formatLastLogin(user.lastLogin)} />
            </div>
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button className="secondary-btn flex-1 px-3 py-2" onClick={() => onEdit(user)}><UserCog className="h-4 w-4" /> Edit</button>
              <button className="secondary-btn flex-1 px-3 py-2 text-rose-500" onClick={() => onDelete(user)}><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <span>{filteredCount} accounts - Page {page} of {pageCount}</span>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="secondary-btn px-3 py-2" disabled={page <= 1} onClick={onPreviousPage}>Previous</button>
          <button className="secondary-btn px-3 py-2" disabled={page >= pageCount} onClick={onNextPage}>Next</button>
        </div>
      </div>
    </>
  );
}

function UserIdentity({ user }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar name={user.name} />
      <div className="min-w-0">
        <p className="truncate font-bold">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
      </div>
    </div>
  );
}

function UserAvatar({ name }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 font-bold text-blue-600 dark:bg-blue-500/10">
      {name?.[0] || "U"}
    </div>
  );
}

function AccountActions({ user, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-2">
      <button className="secondary-btn px-3 py-2" onClick={() => onEdit(user)}><UserCog className="h-4 w-4" /> Edit</button>
      <button className="secondary-btn px-3 py-2 text-rose-500" onClick={() => onDelete(user)}><Trash2 className="h-4 w-4" /> Delete</button>
    </div>
  );
}

function MobileRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-semibold text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

function Sortable({ label, sortKey, sort, setSort }) {
  const active = sort.key === sortKey;
  return (
    <th className="px-5 py-4">
      <button className="font-bold uppercase tracking-wide" onClick={() => setSort((current) => ({ key: sortKey, direction: current.key === sortKey && current.direction === "asc" ? "desc" : "asc" }))}>
        {label} {active ? (sort.direction === "asc" ? "ASC" : "DESC") : ""}
      </button>
    </th>
  );
}

function formatLastLogin(lastLogin) {
  return lastLogin ? new Date(lastLogin).toLocaleString() : "Never";
}
