import CrudModal from "./CrudModal.jsx";

export default function ConfirmDialog({ open, title = "Confirm action", description, busy, onCancel, onConfirm }) {
  return (
    <CrudModal open={open} title={title} onClose={onCancel} width="max-w-md">
      <p className="text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="secondary-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="premium-btn bg-rose-600 hover:bg-rose-700" onClick={onConfirm} disabled={busy}>{busy ? "Deleting..." : "Delete"}</button>
      </div>
    </CrudModal>
  );
}
