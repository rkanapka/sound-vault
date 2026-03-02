import { useEffect, useState } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { useSearch } from './hooks/useSearch'
import { useLibrary } from './hooks/useLibrary'
import SearchPanel from './components/SearchPanel'
import LibraryPanel from './components/LibraryPanel'
import Player from './components/Player'
import NowPlaying from './components/NowPlaying'
import { Globe } from 'lucide-react'

export default function App() {
  const player = usePlayer()
  const search = useSearch()
  const library = useLibrary()
  const [infoSong, setInfoSong] = useState(null)
  const [activePanel, setActivePanel] = useState(null)

  useEffect(() => {
    library.loadArtists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlay = (track, queue) => {
    player.play(queue, queue.indexOf(track))
  }

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  const hasSoulseekResults = Object.keys(search.results).length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-12 px-5 flex items-center gap-2.5 border-b border-slate-800">
        <span className="text-emerald-400 text-lg leading-none">♫</span>
        <span className="text-sm font-semibold tracking-wide text-slate-200">Sound Vault</span>
      </header>

      {/* Main layout */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* Icon nav */}
        <nav className="flex-none w-11 flex flex-col items-center py-2 gap-1 border-r border-slate-800">
          <button
            onClick={() => togglePanel('soulseek')}
            title="Soulseek"
            className={`
              relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors
              ${
                activePanel === 'soulseek'
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'
              }
            `}
          >
            <Globe size={15} />
            {hasSoulseekResults && activePanel !== 'soulseek' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        </nav>

        {/* Soulseek panel (toggleable) */}
        {activePanel === 'soulseek' && (
          <>
            <SearchPanel search={search} />
            <div className="w-px bg-slate-800 flex-none" />
          </>
        )}

        {/* Library */}
        <LibraryPanel
          library={library}
          player={player}
          onPlay={handlePlay}
          onShowInfo={setInfoSong}
        />
      </main>

      {/* Persistent player bar */}
      {player.song && <Player player={player} onShowDetails={() => setInfoSong(player.song)} />}

      {/* Song detail modal */}
      {infoSong && <NowPlaying song={infoSong} onClose={() => setInfoSong(null)} />}
    </div>
  )
}
