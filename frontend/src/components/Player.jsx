import { useState } from 'react'
import { SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, Volume2, VolumeX } from 'lucide-react'
import { artUrl } from '../api'

function fmtTime(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Player({ player, onShowDetails }) {
  const {
    song,
    playing,
    currentTime,
    duration,
    volume,
    repeat,
    togglePlay,
    prev,
    next,
    seek,
    setVolume,
    toggleRepeat,
  } = player

  // Local seek drag state - avoids flickering during drag
  const [dragValue, setDragValue] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const progress = duration ? (currentTime / duration) * 100 : 0
  const displayProgress = isDragging && dragValue !== null ? dragValue : progress

  const handleSeekStart = () => {
    setIsDragging(true)
    setDragValue(progress)
  }

  const handleSeekChange = (e) => {
    setDragValue(parseFloat(e.target.value))
  }

  const handleSeekEnd = (e) => {
    const t = (parseFloat(e.target.value) / 100) * duration
    seek(t)
    setIsDragging(false)
    setDragValue(null)
  }

  if (!song) return null

  return (
    <footer className="flex-none border-t border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center gap-3 sm:gap-4 max-w-5xl mx-auto">
        {/* Album art + track info — click to open details */}
        <button
          onClick={onShowDetails}
          className="flex items-center gap-3 flex-none group min-w-0 text-left"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-md overflow-hidden flex-none bg-slate-800 border border-slate-700/50 group-hover:border-slate-600 transition-colors">
            {song.coverArt ? (
              <img src={artUrl(song.coverArt, 88)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                ♫
              </div>
            )}
          </div>
          <div className="hidden sm:block flex-none w-36 lg:w-48 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate leading-snug group-hover:text-emerald-400 transition-colors">
              {song.title}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {song.artist}
              {song.album ? ` · ${song.album}` : ''}
            </p>
          </div>
        </button>

        {/* Controls + progress */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={prev}
              className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-800"
            >
              <SkipBack size={15} />
            </button>
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
            >
              {playing ? (
                <Pause size={13} fill="white" />
              ) : (
                <Play size={13} fill="white" className="ml-0.5" />
              )}
            </button>
            <button
              onClick={next}
              className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-800"
            >
              <SkipForward size={15} />
            </button>
            <button
              onClick={toggleRepeat}
              title={
                repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'
              }
              className={`p-1.5 rounded-md transition-colors ${
                repeat === 'off'
                  ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                  : 'text-emerald-400 hover:bg-slate-800'
              }`}
            >
              {repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 tabular-nums w-8 text-right flex-none">
              {fmtTime(isDragging ? (dragValue / 100) * duration : currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={displayProgress}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onChange={handleSeekChange}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              className="flex-1 h-1 cursor-pointer"
              style={{ '--range-pct': `${displayProgress}%` }}
            />
            <span className="text-xs text-slate-600 tabular-nums w-8 flex-none">
              {fmtTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume - hidden on small screens */}
        <div className="hidden md:flex items-center gap-2 flex-none w-24 lg:w-28">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-none"
          >
            {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 cursor-pointer"
            style={{ '--range-pct': `${volume * 100}%` }}
          />
        </div>
      </div>
    </footer>
  )
}
