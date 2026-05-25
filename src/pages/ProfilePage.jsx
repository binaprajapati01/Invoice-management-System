import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { KeyRound, Mail, Phone, ShieldCheck, Upload, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import api from "../lib/api.js";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  department: z.string().optional()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters")
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const initials = useMemo(() => getInitials(user?.name || user?.email), [user]);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", department: "" }
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });
  const { reset: resetProfileForm } = profileForm;

  useEffect(() => {
    resetProfileForm({
      name: user?.name || "",
      phone: user?.phone || "",
      department: user?.department || ""
    });
  }, [resetProfileForm, user]);

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      await updateProfile({ avatar: data.url }, "Avatar updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024
  });

  const saveProfile = async (values) => {
    try {
      await updateProfile(values, "Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
    }
  };

  const changePassword = async (values) => {
    try {
      await updateProfile({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      }, "Password updated");
      passwordForm.reset();
    } catch (error) {
      toast.error(error.response?.data?.message || "Password update failed");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" description="Manage your identity, contact details, avatar, and password." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="premium-card text-center">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 to-purple-600 shadow-glow">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name || "Profile avatar"} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-4xl font-black text-white">{initials}</div>
            )}
          </div>
          <h2 className="mt-5 text-2xl font-black">{user?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.role}</p>
          <div
            {...getRootProps()}
            className={`mt-6 cursor-pointer rounded-2xl border border-dashed p-4 text-sm transition ${isDragActive ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800"}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-5 w-5" />
            <p className="mt-2 font-semibold">{uploading ? "Uploading..." : "Upload avatar"}</p>
          </div>
          <div className="mt-6 space-y-3 text-left">
            <Info icon={Mail} label="Email" value={user?.email} />
            <Info icon={ShieldCheck} label="Role" value={user?.role} />
            <Info icon={Phone} label="Phone" value={user?.phone || "Not added"} />
          </div>
        </div>

        <div className="space-y-5">
          <form className="premium-card" onSubmit={profileForm.handleSubmit(saveProfile)}>
            <h2 className="text-lg font-bold">Profile details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input label="Full name" error={profileForm.formState.errors.name?.message} register={profileForm.register("name")} />
              <label className="block"><span className="premium-label">Email</span><input className="premium-input mt-2" value={user?.email || ""} disabled /></label>
              <Input label="Department" error={profileForm.formState.errors.department?.message} register={profileForm.register("department")} />
              <Input label="Phone" error={profileForm.formState.errors.phone?.message} register={profileForm.register("phone")} />
            </div>
            <button className="premium-btn mt-5" disabled={profileForm.formState.isSubmitting}><UserRound className="h-4 w-4" /> {profileForm.formState.isSubmitting ? "Saving..." : "Save profile"}</button>
          </form>

          <form className="premium-card" onSubmit={passwordForm.handleSubmit(changePassword)}>
            <h2 className="text-lg font-bold">Change password</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Input label="Current password" type="password" error={passwordForm.formState.errors.currentPassword?.message} register={passwordForm.register("currentPassword")} />
              <Input label="New password" type="password" error={passwordForm.formState.errors.newPassword?.message} register={passwordForm.register("newPassword")} />
              <Input label="Confirm password" type="password" error={passwordForm.formState.errors.confirmPassword?.message} register={passwordForm.register("confirmPassword")} />
            </div>
            <button className="premium-btn mt-5" disabled={passwordForm.formState.isSubmitting}><KeyRound className="h-4 w-4" /> {passwordForm.formState.isSubmitting ? "Updating..." : "Update password"}</button>
          </form>
        </div>
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><Icon className="h-5 w-5 text-blue-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="break-all font-bold">{value}</p></div></div>;
}

function Input({ label, register, error, type = "text" }) {
  return <label className="block"><span className="premium-label">{label}</span><input type={type} className="premium-input mt-2" {...register} />{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}

function getInitials(value = "") {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
