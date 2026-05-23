import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CrudModal({ open, title, children, onClose, width = "max-w-2xl" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className={`w-full ${width} rounded-[28px] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950`}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">{title}</h2>
              <button className="grid h-10 w-10 place-items-center rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900" onClick={onClose} aria-label="Close modal"><X className="h-5 w-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
