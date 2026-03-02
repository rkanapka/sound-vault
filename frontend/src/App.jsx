import { useEffect, useState } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { useSearch } from './hooks/useSearch'
import { useLibrary } from './hooks/useLibrary'
import SearchPanel from './components/SearchPanel'
import LibraryPanel from './components/LibraryPanel'
import Player from './components/Player'
import NowPlaying from './components/NowPlaying'

export default function App() {
  const player = usePlayer()
  const search = useSearch()
  const library = useLibrary()
  const [infoSong, setInfoSong] = useState(null)

  useEffect(() => {
    library.loadArtists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlay = (track, queue) => {
    player.play(queue, queue.indexOf(track))
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-12 px-5 flex items-center gap-2.5 border-b border-slate-800">
        <span className="text-emerald-400 text-lg leading-none">♫</span>
        <span className="text-sm font-semibold tracking-wide text-slate-200">Sound Vault</span>
      </header>

      {/* Two-panel layout */}
      <main className="flex flex-1 min-h-0 overflow-hidden flex-col sm:flex-row">
        <SearchPanel search={search} />
        <div className="hidden sm:block w-px bg-slate-800 flex-none" />
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
