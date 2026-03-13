import { useEffect, useState } from 'react'
import { getSong } from './api'
import { usePlayer } from './hooks/usePlayer'
import { useDiscover } from './hooks/useDiscover'
import { useSearch } from './hooks/useSearch'
import { useLibrary } from './hooks/useLibrary'
import { usePlaylists } from './hooks/usePlaylists'
import { useFavorites } from './hooks/useFavorites'
import DiscoverPanel from './components/DiscoverPanel'
import SearchPanel from './components/SearchPanel'
import LibraryPanel from './components/LibraryPanel'
import Player from './components/Player'
import NowPlaying from './components/NowPlaying'
import BrandMark from './components/BrandMark'
import { Compass, Globe, Heart, Home, Library, ListMusic } from 'lucide-react'

const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1'
const spacebarTrackButtonSelector = '[data-spacebar-play-toggle]'
const spacebarIgnoreSelector =
  'input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="slider"]'
const spacebarInteractiveSelector = 'button, a[href], [role="button"], [role="link"]'

function shouldHandleSpacebarShortcut(target) {
  if (!(target instanceof Element)) return true
  if (target.closest(spacebarIgnoreSelector)) return false

  const interactiveTarget = target.closest(spacebarInteractiveSelector)
  if (interactiveTarget && !interactiveTarget.matches(spacebarTrackButtonSelector)) return false

  return true
}

export default function App() {
  const player = usePlayer()
  const discover = useDiscover()
  const search = useSearch()
  const library = useLibrary()
  const playlists = usePlaylists()
  const favorites = useFavorites()
  const { song: currentSong, togglePlay } = player
  const [infoSong, setInfoSong] = useState(null)
  const [activeRoute, setActiveRoute] = useState('home') // 'home' | 'discover' | 'library' | 'playlists' | 'favorites' | 'soulseek'

  useEffect(() => {
    discover.init()
    library.init()
    playlists.init()
    favorites.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlay = (track, queue) => {
    player.play(queue, queue.indexOf(track))
  }

  const hasSoulseekResults = Object.keys(search.results).length > 0
  const { view: libraryView, loadHome, openLibrary } = library
  const { playlists: playlistList, loadPlaylists } = playlists
  const openPlaylistsList = () => {
    playlists.backToList()
    loadPlaylists()
    setActiveRoute('playlists')
  }

  const openDiscoverArtist = async (card) => {
    if (!card.artistId) return
    setActiveRoute('library')
    await library.goToArtist({ id: card.artistId, name: card.title })
  }

  const openDiscoverAlbum = async (card) => {
    if (!card.albumId) return
    setActiveRoute('library')
    await library.goToAlbum(
      { id: card.albumId, artistId: card.artistId ?? null },
      { origin: 'albums' }
    )
  }

  const playDiscoverTrack = async (card) => {
    if (!card.songId) return
    const data = await getSong(card.songId)
    const song = data?.['subsonic-response']?.song
    if (!song) return
    player.play([song], 0)
  }

  const openDiscoverGlobal = async (kind = 'artists') => {
    setActiveRoute('discover')
    await discover.showGlobal(kind, { page: 1, ensurePage: true })
  }

  const openDiscoverTag = async (tagName) => {
    const normalizedTag = tagName?.trim()
    if (!normalizedTag) return
    setActiveRoute('discover')
    await discover.showTag(normalizedTag)
  }

  const openDiscoverDetail = async (target) => {
    if (!target) return
    setActiveRoute('discover')
    if (target.kind && target.title) {
      await discover.openDetailFromCard(target)
      return
    }
    await discover.openDetail(target)
  }

  const sendDiscoverQueryToSoulseek = async (query) => {
    const normalizedQuery = query?.trim()
    if (!normalizedQuery) return
    discover.setSoulseekSeedQuery(normalizedQuery)
    search.setQuery(normalizedQuery)
    setActiveRoute('soulseek')
    await search.startSearch(normalizedQuery)
  }

  useEffect(() => {
    if (activeRoute === 'home' && libraryView !== 'home') loadHome()
    if (activeRoute === 'library' && libraryView === 'home') openLibrary()
    if (activeRoute === 'playlists' && playlistList.length === 0) loadPlaylists()
  }, [activeRoute, libraryView, playlistList.length, loadHome, openLibrary, loadPlaylists])

  useEffect(() => {
    if (!currentSong) return undefined

    const handleKeyDown = (event) => {
      if (event.code !== 'Space') return
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (!shouldHandleSpacebarShortcut(event.target)) return

      event.preventDefault()
      togglePlay()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSong, togglePlay])

  if (isEmbed) {
    return (
      <div className="sv-app-shell flex flex-col h-screen text-slate-100 overflow-hidden">
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
            onClick={() => setActiveRoute('discover')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeRoute === 'discover'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Discover
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
          {activeRoute === 'discover' ? (
            <DiscoverPanel
              discover={discover}
              onOpenArtist={openDiscoverArtist}
              onOpenAlbum={openDiscoverAlbum}
              onPlayTrack={playDiscoverTrack}
              onOpenDetail={openDiscoverDetail}
              onSearchSoulseek={sendDiscoverQueryToSoulseek}
            />
          ) : activeRoute === 'soulseek' ? (
            <SearchPanel search={search} embedded />
          ) : (
            <LibraryPanel
              library={library}
              player={player}
              onPlay={handlePlay}
              onShowInfo={setInfoSong}
              playlists={playlists}
              favorites={favorites}
              discover={discover}
              section={activeRoute === 'playlists' ? 'playlists' : activeRoute}
              onNavigate={setActiveRoute}
              onOpenDiscoverGlobal={openDiscoverGlobal}
              onOpenDiscoverTag={openDiscoverTag}
              onOpenDiscoverArtist={openDiscoverArtist}
              onOpenDiscoverAlbum={openDiscoverAlbum}
              onPlayDiscoverTrack={playDiscoverTrack}
              onOpenDiscoverDetail={openDiscoverDetail}
              onSearchSoulseek={sendDiscoverQueryToSoulseek}
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
    <div className="sv-app-shell flex flex-col h-screen text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-12 px-5 flex items-center gap-2.5 border-b border-slate-800">
        <BrandMark className="w-5 h-5" />
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
              onClick={() => setActiveRoute('discover')}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'discover'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <Compass size={14} />
              <span>Discover</span>
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
            <button
              onClick={() => {
                favorites.load()
                setActiveRoute('favorites')
              }}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors
                ${
                  activeRoute === 'favorites'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <Heart size={14} />
              <span>Liked Songs</span>
              {favorites.songs.length > 0 && (
                <span className="ml-auto text-xs text-slate-500">{favorites.songs.length}</span>
              )}
            </button>
            {playlistList.slice(0, 8).map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  setActiveRoute('playlists')
                  playlists.openPlaylist(playlist)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={playlist.name}
              >
                <ListMusic size={14} className="flex-none" />
                <span className="truncate">{playlist.name}</span>
              </button>
            ))}
            {playlistList.length === 0 && (
              <p className="px-2.5 py-2 text-sm text-slate-600">No playlists yet</p>
            )}
          </div>
        </nav>

        {activeRoute === 'discover' ? (
          <DiscoverPanel
            discover={discover}
            onOpenArtist={openDiscoverArtist}
            onOpenAlbum={openDiscoverAlbum}
            onPlayTrack={playDiscoverTrack}
            onOpenDetail={openDiscoverDetail}
            onSearchSoulseek={sendDiscoverQueryToSoulseek}
          />
        ) : activeRoute === 'soulseek' ? (
          <SearchPanel search={search} embedded />
        ) : (
          <LibraryPanel
            library={library}
            player={player}
            onPlay={handlePlay}
            onShowInfo={setInfoSong}
            playlists={playlists}
            favorites={favorites}
            discover={discover}
            section={activeRoute === 'playlists' ? 'playlists' : activeRoute}
            onNavigate={setActiveRoute}
            onOpenDiscoverGlobal={openDiscoverGlobal}
            onOpenDiscoverTag={openDiscoverTag}
            onOpenDiscoverArtist={openDiscoverArtist}
            onOpenDiscoverAlbum={openDiscoverAlbum}
            onPlayDiscoverTrack={playDiscoverTrack}
            onOpenDiscoverDetail={openDiscoverDetail}
            onSearchSoulseek={sendDiscoverQueryToSoulseek}
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
