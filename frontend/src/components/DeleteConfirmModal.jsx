export default function DeleteConfirmModal({ song, onConfirm, onCancel, deleting }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-100">Delete song?</h2>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          <span className="text-slate-200">{song.title}</span> will be permanently removed from
          disk. This cannot be undone.
        </p>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-transparent animate-spin" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
