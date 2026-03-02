import { Info, Trash2 } from 'lucide-react'

export default function SongMenu({ song, onInfo, onDelete, onClose }) {
  return (
    <>
      {/* Transparent backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 overflow-hidden">
        <button
          onClick={() => {
            onInfo(song)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
        >
          <Info size={14} className="text-slate-400 flex-none" />
          Song Info
        </button>
        <div className="h-px bg-slate-700 mx-2 my-1" />
        <button
          onClick={() => {
            onDelete(song)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors text-left"
        >
          <Trash2 size={14} className="flex-none" />
          Delete
        </button>
      </div>
    </>
  )
}
