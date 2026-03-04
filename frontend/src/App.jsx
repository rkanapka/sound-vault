import { useEffect, useState } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { useSearch } from './hooks/useSearch'
import { useLibrary } from './hooks/useLibrary'
import { usePlaylists } from './hooks/usePlaylists'
import SearchPanel from './components/SearchPanel'
import LibraryPanel from './components/LibraryPanel'
import Player from './components/Player'
import NowPlaying from './components/NowPlaying'
import { Globe, Home, Library, ListMusic } from 'lucide-react'

const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1'

export default function App() {
  const player = usePlayer()
  const search = useSearch()
  const library = useLibrary()
  const playlists = usePlaylists()
  const [infoSong, setInfoSong] = useState(null)
  const [activeRoute, setActiveRoute] = useState('home') // 'home' | 'library' | 'playlists' | 'soulseek'

  useEffect(() => {
    library.init()
    playlists.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlay = (track, queue) => {
    player.play(queue, queue.indexOf(track))
  }

  const hasSoulseekResults = Object.keys(search.results).length > 0
  const { view: libraryView, loadHome, loadArtists } = library
  const { playlists: playlistList, loadPlaylists } = playlists
  const openPlaylistsList = () => {
    playlists.backToList()
    loadPlaylists()
    setActiveRoute('playlists')
  }

  useEffect(() => {
    if (activeRoute === 'home' && libraryView !== 'home') loadHome()
    if (activeRoute === 'library' && libraryView === 'home') loadArtists()
    if (activeRoute === 'playlists' && playlistList.length === 0) loadPlaylists()
  }, [activeRoute, libraryView, playlistList.length, loadHome, loadArtists, loadPlaylists])

  if (isEmbed) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex-none flex border-b border-slate-800">
          <button
            onClick={() => setActiveRoute('home')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeRoute === 'home'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveRoute('library')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeRoute === 'library'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Library
          </button>
          <button
            onClick={openPlaylistsList}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeRoute === 'playlists'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveRoute('soulseek')}
            className={`relative px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeRoute === 'soulseek'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Soulseek
            {hasSoulseekResults && activeRoute !== 'soulseek' && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Active panel */}
        <main className="flex flex-1 min-h-0 overflow-hidden">
          {activeRoute === 'soulseek' ? (
            <SearchPanel search={search} embedded />
          ) : (
            <LibraryPanel
              library={library}
              player={player}
              onPlay={handlePlay}
              onShowInfo={setInfoSong}
              playlists={playlists}
              section={activeRoute === 'playlists' ? 'playlists' : activeRoute}
              onNavigate={setActiveRoute}
            />
          )}
        </main>

        {/* Persistent player bar */}
        {player.song && <Player player={player} onShowDetails={() => setInfoSong(player.song)} />}

        {/* Song detail modal */}
        {infoSong && <NowPlaying song={infoSong} onClose={() => setInfoSong(null)} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-12 px-5 flex items-center gap-2.5 border-b border-slate-800">
        <span className="text-emerald-400 text-lg leading-none">♫</span>
        <span className="text-sm font-semibold tracking-wide text-slate-200">SoundVault</span>
      </header>

      {/* Main layout */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="flex-none w-56 p-3 border-r border-slate-800 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">
            Sections
          </p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveRoute('home')}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'home'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <Home size={14} />
              <span>Home</span>
            </button>
            <button
              onClick={() => setActiveRoute('library')}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'library'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <Library size={14} />
              <span>Library</span>
            </button>
            <button
              onClick={openPlaylistsList}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'playlists'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <ListMusic size={14} />
              <span>Playlists</span>
            </button>
            <button
              onClick={() => setActiveRoute('soulseek')}
              className={`
                relative w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'soulseek'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <Globe size={14} />
              <span>Soulseek</span>
              {hasSoulseekResults && activeRoute !== 'soulseek' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>

          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mt-5 mb-2.5">
            Playlists
          </p>
          <div className="space-y-1">
            {playlistList.slice(0, 8).map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  setActiveRoute('playlists')
                  playlists.openPlaylist(playlist)
                }}
                className="w-full text-left px-2.5 py-2 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors truncate"
                title={playlist.name}
              >
                {playlist.name}
              </button>
            ))}
            {playlistList.length === 0 && (
              <p className="px-2.5 py-2 text-sm text-slate-600">No playlists yet</p>
            )}
          </div>
        </nav>

        {activeRoute === 'soulseek' ? (
          <SearchPanel search={search} embedded />
        ) : (
          <LibraryPanel
            library={library}
            player={player}
            onPlay={handlePlay}
            onShowInfo={setInfoSong}
            playlists={playlists}
            section={activeRoute === 'playlists' ? 'playlists' : activeRoute}
            onNavigate={setActiveRoute}
          />
        )}
      </main>

      {/* Persistent player bar */}
      {player.song && <Player player={player} onShowDetails={() => setInfoSong(player.song)} />}

      {/* Song detail modal */}
      {infoSong && <NowPlaying song={infoSong} onClose={() => setInfoSong(null)} />}
    </div>
  )
}
