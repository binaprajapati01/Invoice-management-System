import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui.jsx";
import { useAuth } from "../state/AuthContext.jsx";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  department: z.string().optional()
});

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: user });

  useEffect(() => {
    reset(user || {});
  }, [user, reset]);

  const submit = async (values) => {
    try {
      await updateProfile(values);
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" description="Manage your business identity, security preferences, role assignment, and contact details." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="premium-card text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-blue-600 to-purple-600 text-4xl font-black text-white shadow-glow">{user?.name?.[0]}</div>
          <h2 className="mt-5 text-2xl font-black">{user?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.role}</p>
          <div className="mt-6 space-y-3 text-left">
            <Info icon={Mail} label="Email" value={user?.email} />
            <Info icon={ShieldCheck} label="Role" value={user?.role} />
            <Info icon={KeyRound} label="Security" value="JWT protected" />
          </div>
        </div>
        <form className="premium-card" onSubmit={handleSubmit(submit)}>
          <h2 className="text-lg font-bold">Profile details</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input label="Full name" error={errors.name?.message} register={register("name")} />
            <label className="block"><span className="premium-label">Email</span><input className="premium-input mt-2" value={user?.email || ""} disabled /></label>
            <Input label="Department" register={register("department")} />
            <Input label="Phone" register={register("phone")} />
          </div>
          <button className="premium-btn mt-5" disabled={isSubmitting}><UserRound className="h-4 w-4" /> {isSubmitting ? "Updating..." : "Update profile"}</button>
        </form>
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><Icon className="h-5 w-5 text-blue-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="font-bold">{value}</p></div></div>;
}

function Input({ label, register, error }) {
  return <label className="block"><span className="premium-label">{label}</span><input className="premium-input mt-2" {...register} />{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}
