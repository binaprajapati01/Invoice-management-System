import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, User, UserCog, UsersRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../state/AuthContext.jsx";
import { CustomSelect } from "../components/ui.jsx";

const roles = [
  { label: "Super Admin", value: "Super Admin", icon: ShieldCheck },
  { label: "Admin", value: "Admin", icon: UserCog },
  { label: "Manager", value: "Manager", icon: BriefcaseBusiness }
];

const features = ["Role-aware approvals and dashboards", "Live invoices with QR payments", "Auditable clients, payments, and reports"];

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, forgotPassword, verifyOtp, resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const otpRefs = useRef([]);

  const schema = useMemo(() => buildSchema(mode), [mode]);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "Manager",
      email: location.state?.email || "",
      terms: false,
      remember: true
    }
  });

  const password = watch("password") || "";
  const role = watch("role");

  const submit = async (values) => {
    if (mode === "login") {
      await login(values);
      navigate("/dashboard");
      return;
    }
    if (mode === "signup") {
      await signup(values);
      toast.success("Account created. Sign in to continue.");
      navigate("/login");
      return;
    }
    if (mode === "forgot") {
      await forgotPassword(values);
      navigate("/verify-otp", { state: { email: values.email } });
      return;
    }
    if (mode === "otp") {
      const data = await verifyOtp({ email: values.email, otp: otpDigits.join("") });
      sessionStorage.setItem("invoiceflow_reset_token", data.resetToken);
      navigate("/reset-password");
      return;
    }
    if (mode === "reset") {
      await resetPassword({ password: values.password, token: sessionStorage.getItem("invoiceflow_reset_token") });
      navigate("/login");
    }
  };

  const isSplit = ["login", "signup"].includes(mode);
  const form = (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <Brand />
      <div className="auth-card premium-card rounded-3xl p-6 sm:p-8">
        <p className="premium-label">{copyFor(mode).eyebrow}</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{copyFor(mode).title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copyFor(mode).body}</p>

        <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-4">
          {mode === "signup" && (
            <Field label="Full name" error={errors.name?.message}>
              <IconInput icon={User} register={register("name")} autoComplete="name" />
            </Field>
          )}

          {["login", "signup", "forgot", "otp"].includes(mode) && (
            <Field label="Email" error={errors.email?.message}>
              <IconInput icon={Mail} register={register("email")} autoComplete="email" />
            </Field>
          )}

          {["login", "signup"].includes(mode) && (
            <CustomSelect label="Role" value={role} onChange={(value) => setValue("role", value, { shouldValidate: true })} options={roles} error={errors.role?.message} />
          )}

          {["login", "signup", "reset"].includes(mode) && (
            <Field label={mode === "reset" ? "New password" : "Password"} error={errors.password?.message}>
              <PasswordInput show={showPassword} setShow={setShowPassword} register={register("password")} />
            </Field>
          )}

          {["signup", "reset"].includes(mode) && (
            <>
              <Field label="Confirm password" error={errors.confirmPassword?.message}>
                <PasswordInput show={showPassword} setShow={setShowPassword} register={register("confirmPassword")} />
              </Field>
              <StrengthBar password={password} />
            </>
          )}

          {mode === "otp" && (
            <Field label="One-time password" error={errors.otp?.message}>
              <div className="grid grid-cols-6 gap-2">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(node) => { otpRefs.current[index] = node; }}
                    className="h-14 rounded-xl border border-slate-200 bg-white text-center text-xl font-black outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                    value={digit}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(event) => {
                      const nextDigit = event.target.value.replace(/\D/g, "").slice(-1);
                      const next = [...otpDigits];
                      next[index] = nextDigit;
                      setOtpDigits(next);
                      setValue("otp", next.join(""), { shouldValidate: true });
                      if (nextDigit && index < 5) otpRefs.current[index + 1]?.focus();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              <input type="hidden" {...register("otp")} />
            </Field>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-3 text-sm font-medium text-slate-600">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600" {...register("terms")} />
              <span>I agree to secure processing of workspace billing data and account access policies.</span>
            </label>
          )}
          {errors.terms?.message && <span className="block text-xs font-semibold text-rose-500">{errors.terms.message}</span>}

          {mode === "login" && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" className="rounded border-slate-300 accent-blue-600" {...register("remember")} /> Remember me</label>
              <Link className="font-bold text-blue-600" to="/forgot-password">Forgot password?</Link>
            </div>
          )}

          <button className="premium-btn w-full rounded-xl" disabled={isSubmitting || (mode === "otp" && otpDigits.join("").length !== 6)}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel(mode)} {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {["login", "signup"].includes(mode) && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "New to InvoiceFlow?" : "Already have an account?"}{" "}
            <Link className="font-bold text-blue-600" to={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create account" : "Sign in"}</Link>
          </p>
        )}
      </div>
    </motion.div>
  );

  if (!isSplit) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-950">{form}</main>;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden items-center justify-center overflow-hidden p-10 text-white lg:flex">
          <div className="absolute inset-0 animate-gradient bg-[linear-gradient(135deg,#0f172a,#2563eb,#10b981,#111827)] bg-[length:240%_240%]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(255,255,255,.22),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,.16),transparent_26%)]" />
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-xl">
            <p className="premium-label text-blue-100">Premium finance operations</p>
            <h2 className="mt-4 text-6xl font-black leading-[0.95] tracking-tight">Invoices, payments, and revenue in one command center.</h2>
            <div className="mt-10 grid gap-4">
              {features.map((item, index) => (
                <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * index }} key={item} className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/12 p-4 text-white shadow-soft backdrop-blur">
                  <BadgeCheck className="h-6 w-6 text-emerald-200" />
                  <span className="font-bold">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
        <section className="flex items-center justify-center px-5 py-10">{form}</section>
      </div>
    </main>
  );
}

function buildSchema(mode) {
  const base = {
    email: ["login", "signup", "forgot", "otp"].includes(mode) ? z.string().email("Enter a valid email") : z.string().optional(),
    password: ["login", "signup", "reset"].includes(mode) ? z.string().min(8, "Use at least 8 characters") : z.string().optional(),
    confirmPassword: ["signup", "reset"].includes(mode) ? z.string().min(8, "Confirm your password") : z.string().optional(),
    role: ["login", "signup"].includes(mode) ? z.enum(["Super Admin", "Admin", "Manager"]) : z.string().optional(),
    otp: mode === "otp" ? z.string().length(6, "Enter the 6 digit OTP") : z.string().optional(),
    terms: mode === "signup" ? z.literal(true, { errorMap: () => ({ message: "Accept the terms to continue" }) }) : z.boolean().optional(),
    remember: z.boolean().optional()
  };
  if (mode === "signup") base.name = z.string().min(2, "Full name is required");
  return z.object(base).refine((data) => !["signup", "reset"].includes(mode) || data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
}

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-glow"><KeyRound className="h-6 w-6" /></div>
      <div>
        <p className="text-xl font-black tracking-tight">InvoiceFlow</p>
        <p className="text-sm text-slate-500">Fintech invoice platform</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return <label className="block"><span className="premium-label">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}

function IconInput({ icon: Icon, register, autoComplete }) {
  return <div className="relative"><Icon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input className="premium-input rounded-xl pl-12" autoComplete={autoComplete} {...register} /></div>;
}

function PasswordInput({ show, setShow, register }) {
  return (
    <div className="relative">
      <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input className="premium-input rounded-xl px-12" type={show ? "text" : "password"} autoComplete="current-password" {...register} />
      <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" type="button" onClick={() => setShow((value) => !value)} aria-label="Toggle password visibility">
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

function StrengthBar({ password }) {
  const score = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  return <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((item) => <span key={item} className={`h-2 rounded-full ${item < score ? "bg-emerald-500" : "bg-slate-200"}`} />)}</div>;
}

function copyFor(mode) {
  return {
    login: { eyebrow: "Secure login", title: "Welcome back", body: "Sign in to manage invoices, clients, payments, and analytics." },
    signup: { eyebrow: "Create workspace", title: "Start with InvoiceFlow", body: "Create your first account and configure team access securely." },
    forgot: { eyebrow: "Password recovery", title: "Send reset OTP", body: "Enter your account email to receive a one-time password." },
    otp: { eyebrow: "Verification", title: "Enter OTP", body: "Use the six digit code delivered for this reset request." },
    reset: { eyebrow: "Reset password", title: "Create new password", body: "Choose a strong password to restore access." }
  }[mode];
}

function buttonLabel(mode) {
  return { login: "Sign In", signup: "Create Account", forgot: "Send OTP", otp: "Verify OTP", reset: "Reset Password" }[mode];
}
