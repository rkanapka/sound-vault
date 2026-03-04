import { useEffect, useState } from 'react'
import { X, Music } from 'lucide-react'
import { getSong, artUrl } from '../api'

function fmtSize(bytes) {
  if (!bytes) return null
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDuration(secs) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function NowPlaying({ song, onClose }) {
  const [extra, setExtra] = useState(null)

  useEffect(() => {
    if (!song?.id) return
    setExtra(null)
    getSong(song.id)
      .then((data) => setExtra(data?.['subsonic-response']?.song ?? null))
      .catch(() => {})
  }, [song?.id])

  if (!song) return null

  // Merge: extra has the same fields but may include bpm, comment, etc.
  const s = extra ? { ...song, ...extra } : song

  const meta = [
    ['Album', s.album],
    ['Artist', s.artist],
    ['Year', s.year],
    ['Genre', s.genre],
    ['Track', s.track],
    ['Duration', fmtDuration(s.duration)],
    ['Bitrate', s.bitRate ? `${s.bitRate} kbps` : null],
    ['Format', s.suffix?.toUpperCase()],
    ['Size', fmtSize(s.size)],
    ['BPM', s.bpm || null],
    ['Plays', s.playCount ?? null],
  ].filter(([, v]) => v != null)

  return (
    <div
      className="sv-modal-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="sv-modal-panel relative rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-600/40"
        >
          <X size={14} />
        </button>

        {/* Album art */}
        <div className="aspect-square w-full bg-slate-800">
          {s.coverArt ? (
            <img src={artUrl(s.coverArt, 400)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-700">
              <Music size={72} strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Song info + metadata */}
        <div className="p-4 pb-6">
          <p className="text-base font-semibold text-slate-100 truncate leading-snug">{s.title}</p>
          <p className="text-sm text-slate-500 truncate mt-0.5">{s.artist}</p>

          {meta.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                    {label}
                  </dt>
                  <dd className="text-xs text-slate-300 mt-0.5 truncate">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
