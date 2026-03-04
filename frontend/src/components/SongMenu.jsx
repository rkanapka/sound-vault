import { Info, ListPlus, Trash2 } from 'lucide-react'

export default function SongMenu({ song, onInfo, onDelete, onAddToPlaylist, onClose }) {
  return (
    <>
      {/* Transparent backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <div className="sv-menu-panel absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg py-1 overflow-hidden">
        <button
          onClick={() => {
            onInfo(song)
            onClose()
          }}
          className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
        >
          <Info size={14} className="sv-menu-icon flex-none" />
          Song Info
        </button>
        {onAddToPlaylist && (
          <button
            onClick={() => {
              onAddToPlaylist(song)
              onClose()
            }}
            className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
          >
            <ListPlus size={14} className="sv-menu-icon flex-none" />
            Add to playlist
          </button>
        )}
        <div className="sv-menu-divider h-px mx-2 my-1" />
        <button
          onClick={() => {
            onDelete(song)
            onClose()
          }}
          className="sv-menu-item sv-menu-danger w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
        >
          <Trash2 size={14} className="flex-none" />
          Delete
        </button>
      </div>
    </>
  )
}
