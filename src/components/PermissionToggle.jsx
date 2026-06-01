import { useEffect, useState } from "react";

export default function PermissionToggle({ userId, initialEnabled = true, onToggle }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  const handleToggle = async () => {
    if (loading) return;
    const nextValue = !enabled;
    setLoading(true);
    try {
      await onToggle(userId, nextValue);
      setEnabled(nextValue);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle permission"
        disabled={loading}
        onClick={handleToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
        } ${loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">
        {loading ? "Saving..." : enabled ? "Access on" : "Access off"}
      </span>
    </div>
  );
}
