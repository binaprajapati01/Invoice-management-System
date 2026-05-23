import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="premium-label">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({ icon: Icon, label, value, trend, tone = "blue" }) {
  const tones = {
    blue: "from-blue-600/12 to-blue-600/5 text-blue-600",
    emerald: "from-emerald-500/12 to-emerald-500/5 text-emerald-600",
    purple: "from-purple-600/12 to-purple-600/5 text-purple-600",
    slate: "from-slate-500/12 to-slate-500/5 text-slate-700 dark:text-slate-200"
  };
  return (
    <motion.div whileHover={{ y: -4 }} className="premium-card overflow-hidden">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
          <ArrowUpRight className="h-3.5 w-3.5" /> {trend}
        </p>
      </div>
    </motion.div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300",
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300",
    Pending: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300",
    Sent: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300",
    Overdue: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300",
    Draft: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300",
    Inactive: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${map[status] || map.Draft}`}>{status}</span>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="premium-card flex min-h-72 flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

export function CustomSelect({ label, value, onChange, options = [], placeholder = "Select", error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const normalized = options.map((option) => typeof option === "string" ? { label: option, value: option } : option);
  const selected = normalized.find((option) => option.value === value) || normalized[0];
  const SelectedIcon = selected?.icon;

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <label className="block" ref={ref}>
      {label && <span className="premium-label">{label}</span>}
      <div className="relative mt-2">
        <button
          type="button"
          className={`premium-input flex items-center justify-between gap-3 text-left ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" : ""}`}
          onClick={() => setOpen((state) => !state)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-3">
            {SelectedIcon && <SelectedIcon className="h-5 w-5 shrink-0 text-blue-600" />}
            <span className={selected ? "truncate font-semibold" : "text-slate-400"}>{selected?.label || placeholder}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft dark:border-slate-700 dark:bg-slate-900" role="listbox">
            {normalized.map((option) => (
              <OptionButton
                type="button"
                key={option.value}
                option={option}
                active={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}
    </label>
  );
}

function OptionButton({ option, active, ...props }) {
  const Icon = option.icon;
  return (
    <button
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 ${active ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10" : "text-slate-700 dark:text-slate-200"}`}
      role="option"
      aria-selected={active}
      {...props}
    >
      <span className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-blue-600" />}
        <span>{option.label}</span>
      </span>
      {active && <Check className="h-4 w-4 text-blue-600" />}
    </button>
  );
}
