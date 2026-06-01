import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LockKeyhole, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { CustomSelect, PageHeader, SearchBar } from "../components/ui.jsx";
import AccountsTable from "../components/AccountsTable.jsx";
import CrudModal from "../components/CrudModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Skeleton from "../components/Skeleton.jsx";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be 8+ characters").optional().or(z.literal("")),
  role: z.enum(["Admin", "Manager"]),
  phone: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().default(true)
});

export default function UsersPage({ type = "Manager" }) {
  const { users, loading, fetchUsers, saveUser, updateUserPermission, deleteUser, deleteManager } = useAppStore();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => users
    .filter((user) => type === "Permissions" || normalizeRole(user.role) === normalizeRole(type))
    .filter((user) => [user.name, user.email, user.department, user.phone].join(" ").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => compare(a, b, sort)), [type, users, query, sort]);
  const pageSize = 8;
  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    fetchUsers().catch((error) => toast.error(error.message));
  }, []);

  const openForm = (user = null) => {
    setEditing(user);
    setOpen(true);
  };

  useEffect(() => {
    setPage(1);
  }, [query, type]);

  return (
    <>
      <PageHeader
        eyebrow={type === "Permissions" ? "RBAC" : "Team management"}
        title={type === "Permissions" ? "Permission Management" : `${type} Management`}
        description="Create accounts, review activity, control permissions, and deactivate access from a secure operational view."
        action={type !== "Permissions" && <button className="premium-btn w-full sm:w-auto" onClick={() => openForm()}><Plus className="h-4 w-4" /> Add {type}</button>}
      />

      {type === "Permissions" && (
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {["Invoice Operations", "Template Control", "Platform Administration"].map((group, index) => (
            <div key={group} className="premium-card">
              <LockKeyhole className="h-7 w-7 text-blue-600" />
              <h3 className="mt-4 text-lg font-bold">{group}</h3>
              <p className="mt-2 text-sm text-slate-500">{["Managers can create, edit, export, email, and delete their invoices.", "Admins can upload, map, preview, and publish templates.", "Super Admin controls admins, permissions, audit logs, and global settings."][index]}</p>
            </div>
          ))}
        </div>
      )}

      <div className="premium-card overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold">Accounts</h2>
          <SearchBar value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts..." />
        </div>
        {loading.users ? <div className="p-5"><Skeleton /></div> : (
          <AccountsTable
            accounts={rows}
            filteredCount={filtered.length}
            page={page}
            pageCount={pageCount}
            sort={sort}
            setSort={setSort}
            onEdit={openForm}
            onDelete={setDeleting}
            onPermissionToggle={async (id, hasAccess) => {
              try {
                await updateUserPermission(id, hasAccess);
                toast.success(hasAccess ? "Access enabled" : "Access disabled");
              } catch (error) {
                toast.error(error.message);
                throw error;
              }
            }}
            onPreviousPage={() => setPage(page - 1)}
            onNextPage={() => setPage(page + 1)}
          />
        )}
      </div>

      <UserFormModal open={open} user={editing} defaultRole={type === "Admin" ? "Admin" : "Manager"} onClose={() => setOpen(false)} onSave={async (values) => {
        try {
          const payload = { ...values };
          if (!payload.password) delete payload.password;
          await saveUser(payload, editing?._id);
          toast.success(editing ? "User updated" : "User created");
          setOpen(false);
        } catch (error) {
          toast.error(error.message);
        }
      }} />

      <ConfirmDialog open={Boolean(deleting)} title={`Delete ${type === "Manager" ? "manager" : "account"}`} description={`Permanently delete ${deleting?.name}? This action will remove the account from the database.`} busy={loading.users} onCancel={() => setDeleting(null)} onConfirm={async () => {
        try {
          if (type === "Manager") {
            await deleteManager(deleting._id);
          } else {
            await deleteUser(deleting._id);
          }
          toast.success(type === "Manager" ? "Manager deleted successfully" : "Account deleted successfully");
          setDeleting(null);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
    </>
  );
}

function UserFormModal({ open, user, defaultRole, onClose, onSave }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: user || { role: defaultRole, isActive: true }
  });

  useEffect(() => {
    reset(user ? { ...user, password: "" } : { name: "", email: "", password: "", role: defaultRole, phone: "", department: "", isActive: true });
  }, [user, defaultRole, reset, open]);

  return (
    <CrudModal open={open} title={user ? "Edit account" : "Create account"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSave)} className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name?.message}><input className="premium-input" {...register("name")} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="premium-input" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><input className="premium-input" type="password" {...register("password")} /></Field>
        <CustomSelect label="Role" value={watch("role")} onChange={(value) => setValue("role", value, { shouldValidate: true })} options={["Admin", "Manager"]} error={errors.role?.message} />
        <Field label="Phone"><input className="premium-input" {...register("phone")} /></Field>
        <Field label="Department"><input className="premium-input" {...register("department")} /></Field>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold dark:border-slate-800"><input type="checkbox" {...register("isActive")} className="h-5 w-5 accent-blue-600" /> Active account</label>
        <div className="flex justify-end gap-3 md:col-span-2"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="premium-btn" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save account"}</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, error, children }) {
  return <label className="block"><span className="premium-label">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}

function compare(a, b, sort) {
  const av = sort.key === "lastLogin" ? new Date(a.lastLogin || 0).getTime() : a[sort.key];
  const bv = sort.key === "lastLogin" ? new Date(b.lastLogin || 0).getTime() : b[sort.key];
  const result = typeof av === "number" || typeof bv === "number" ? Number(av || 0) - Number(bv || 0) : String(av || "").localeCompare(String(bv || ""));
  return sort.direction === "asc" ? result : -result;
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase();
}
