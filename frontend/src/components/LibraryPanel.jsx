import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  Music,
  Disc,
  ChevronRight,
  ChevronLeft,
  Mic2,
  AlertCircle,
  MoreHorizontal,
  LayoutGrid,
  LayoutList,
  ListMusic,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { artUrl, deleteSong } from '../api'
import Breadcrumb from './Breadcrumb'
import SongMenu from './SongMenu'
import DeleteConfirmModal from './DeleteConfirmModal'

function fmtDuration(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LibraryPanel({
  library,
  player,
  onPlay,
  onShowInfo,
  playlists,
  section,
  onNavigate,
}) {
  const {
    view,
    newestAlbums,
    recentAlbums,
    artists,
    albums,
    currentAlbum,
    tracks,
    searchResults,
    breadcrumbs,
    loading,
    error,
    scanning,
    loadHome,
    loadArtists,
    goToArtist,
    goToAlbum,
    goBackToArtist,
    searchLib,
    scan,
    pollScanDone,
  } = library

  const [libQuery, setLibQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmSong, setConfirmSong] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [albumsView, setAlbumsView] = useState(
    () => localStorage.getItem('sv-albums-view') ?? 'list'
  )
  const [albumsSort, setAlbumsSort] = useState(
    () => localStorage.getItem('sv-albums-sort') ?? 'year-asc'
  )
  const [tracksSort, setTracksSort] = useState(
    () => localStorage.getItem('sv-tracks-sort') ?? 'track'
  )

  const [playlistMenuId, setPlaylistMenuId] = useState(null)
  const [createPlaylistMode, setCreatePlaylistMode] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [renamingPlaylist, setRenamingPlaylist] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [playlistDetailMenuOpen, setPlaylistDetailMenuOpen] = useState(false)
  const [openPlaylistTrackMenuId, setOpenPlaylistTrackMenuId] = useState(null)
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null)
  const [addToPlaylistCreating, setAddToPlaylistCreating] = useState(false)
  const [addToPlaylistNewName, setAddToPlaylistNewName] = useState('')

  const sortedAlbums = useMemo(() => {
    const arr = [...albums]
    if (albumsSort === 'year-asc') return arr.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    if (albumsSort === 'year-desc') return arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    if (albumsSort === 'name-asc') return arr.sort((a, b) => a.name.localeCompare(b.name))
    if (albumsSort === 'name-desc') return arr.sort((a, b) => b.name.localeCompare(a.name))
    return arr
  }, [albums, albumsSort])

  const sortedTracks = useMemo(() => {
    const arr = [...tracks]
    if (tracksSort === 'track') return arr.sort((a, b) => (a.track ?? 999) - (b.track ?? 999))
    if (tracksSort === 'title') return arr.sort((a, b) => a.title.localeCompare(b.title))
    if (tracksSort === 'duration') return arr.sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0))
    return arr
  }, [tracks, tracksSort])

  const reloadView = useCallback(() => {
    if (view === 'album' && currentAlbum) goToAlbum(currentAlbum)
    else if (view === 'search') searchLib(libQuery)
    else if (view === 'home') loadHome()
    else loadArtists()
  }, [view, currentAlbum, goToAlbum, searchLib, libQuery, loadHome, loadArtists])

  const handleSearch = (e) => {
    e.preventDefault()
    onNavigate('library')
    searchLib(libQuery)
  }

  const handleBreadcrumb = (action) => {
    if (action === 'home') {
      onNavigate('home')
      setLibQuery('')
      loadHome()
    } else if (action === 'artists') {
      onNavigate('library')
      setLibQuery('')
      loadArtists()
    } else if (action === 'artist') {
      onNavigate('library')
      goBackToArtist()
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await deleteSong(confirmSong.id)
      setConfirmSong(null)
      pollScanDone().then(reloadView)
    } catch (err) {
      console.error('Delete failed:', err)
      setConfirmSong(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleShowAddToPlaylist = (song) => {
    setAddToPlaylistSong(song)
    setAddToPlaylistCreating(false)
    setAddToPlaylistNewName('')
    playlists.loadPlaylists()
  }

  const handleAddToPlaylist = async (playlistId) => {
    if (!addToPlaylistSong) return
    await playlists.addTrack(playlistId, addToPlaylistSong.id)
    setAddToPlaylistSong(null)
  }

  const handleAddToPlaylistNew = async (e) => {
    e.preventDefault()
    if (!addToPlaylistNewName.trim() || !addToPlaylistSong) return
    await playlists.create(addToPlaylistNewName.trim(), [addToPlaylistSong.id])
    setAddToPlaylistNewName('')
    setAddToPlaylistCreating(false)
    setAddToPlaylistSong(null)
  }

  const handleCreatePlaylist = async (e) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    await playlists.create(newPlaylistName.trim())
    setNewPlaylistName('')
    setCreatePlaylistMode(false)
  }

  const handleRenamePlaylist = async (e) => {
    e.preventDefault()
    if (!renameValue.trim() || !renamingPlaylist) return
    await playlists.rename(renamingPlaylist.id, renameValue.trim())
    setRenamingPlaylist(null)
    setRenameValue('')
  }

  const openPlaylistFromHome = (playlist) => {
    onNavigate('playlists')
    playlists.openPlaylist(playlist)
  }

  return (
    <section className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex-none p-3 border-b border-slate-800">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">
          {section === 'playlists' ? 'Playlists' : 'Library'}
        </p>

        {section !== 'playlists' ? (
          <>
            <div className="flex gap-2">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  value={libQuery}
                  onChange={(e) => setLibQuery(e.target.value)}
                  placeholder="Search library…"
                  className="flex-1 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 transition-colors"
                />
                <button
                  type="submit"
                  className="flex-none flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Search size={13} />
                </button>
              </form>
              <button
                onClick={() => scan(reloadView)}
                disabled={scanning}
                title="Scan library"
                className={`
                  flex-none flex items-center justify-center w-9 h-9 rounded-lg border transition-colors
                  ${
                    scanning
                      ? 'bg-slate-800 border-emerald-500/30 text-emerald-500'
                      : 'bg-slate-800 border-slate-700/60 hover:border-emerald-500/40 text-slate-500 hover:text-emerald-400'
                  }
                `}
              >
                <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
              </button>
            </div>

            {breadcrumbs.length > 0 && (
              <div className="mt-2.5">
                <Breadcrumb crumbs={breadcrumbs} onNavigate={handleBreadcrumb} />
              </div>
            )}
          </>
        ) : playlists.view === 'detail' ? (
          <button
            onClick={playlists.backToList}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronLeft size={12} />
            Playlists
          </button>
        ) : createPlaylistMode ? (
          <form onSubmit={handleCreatePlaylist} className="flex gap-2 items-center">
            <input
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name…"
              className="flex-1 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
            />
            <button
              type="submit"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex-none"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreatePlaylistMode(false)}
              className="text-xs text-slate-600 hover:text-slate-400 flex-none"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreatePlaylistMode(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
          >
            <Plus size={12} />
            New Playlist
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Library section ─────────────────────────────── */}
        {section !== 'playlists' && (
          <>
            {/* Loading */}
            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="m-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={15} className="flex-none mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Home view */}
            {!loading && !error && view === 'home' && (
              <div className="py-3">
                <div className="mb-4">
                  <p className="px-4 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Playlists
                  </p>
                  {playlists.loading ? (
                    <div className="px-4 py-2">
                      <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
                    </div>
                  ) : playlists.playlists.length === 0 ? (
                    <p className="px-4 text-xs text-slate-700">No playlists yet</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
                      {playlists.playlists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => openPlaylistFromHome(pl)}
                          className="flex-none min-w-[120px] rounded-md border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-left hover:border-slate-500 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ListMusic size={12} className="text-slate-500 flex-none" />
                            <p className="text-[11px] text-slate-200 truncate">{pl.name}</p>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-600">
                            {pl.songCount ?? 0} {pl.songCount === 1 ? 'track' : 'tracks'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {[
                  { label: 'Recently Added', albums: newestAlbums },
                  { label: 'Recently Played', albums: recentAlbums },
                ].map(({ label, albums: list }) => (
                  <div key={label} className="mb-4">
                    <p className="px-4 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {label}
                    </p>
                    {list.length === 0 ? (
                      <p className="px-4 text-xs text-slate-700">Nothing here yet</p>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
                        {list.map((album) => (
                          <button
                            key={album.id}
                            onClick={() => goToAlbum(album)}
                            className="flex-none w-20 group text-left"
                          >
                            <div className="w-20 h-20 rounded-md bg-slate-800 overflow-hidden border border-slate-700/50 group-hover:border-slate-500 transition-colors mb-1">
                              {album.coverArt ? (
                                <img
                                  src={artUrl(album.coverArt, 160)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Disc size={20} className="text-slate-600" />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-300 truncate leading-snug group-hover:text-white transition-colors">
                              {album.name}
                            </p>
                            <p className="text-[9px] text-slate-600 truncate leading-snug">
                              {album.artist}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="px-4 pt-2 border-t border-slate-800/50 flex gap-4">
                  <button
                    onClick={loadArtists}
                    className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    Browse all artists →
                  </button>
                  <button
                    onClick={() => onNavigate('playlists')}
                    className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    Playlists →
                  </button>
                </div>
              </div>
            )}

            {/* Artists view */}
            {!loading && !error && view === 'artists' && (
              <ul className="py-1">
                {artists.map((artist) => (
                  <li key={artist.id}>
                    <button
                      onClick={() => goToArtist(artist)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-none border border-slate-700/50 group-hover:border-slate-600 transition-colors overflow-hidden">
                        {artist.coverArt ? (
                          <img
                            src={artUrl(artist.coverArt, 56)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Mic2
                            size={12}
                            className="text-slate-500 group-hover:text-emerald-400 transition-colors"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{artist.name}</p>
                        {artist.albumCount > 0 && (
                          <p className="text-xs text-slate-600">
                            {artist.albumCount} album{artist.albumCount !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        size={13}
                        className="text-slate-700 group-hover:text-slate-500 transition-colors flex-none"
                      />
                    </button>
                  </li>
                ))}
                {artists.length === 0 && (
                  <li className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <Music size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm">No music yet</p>
                      <p className="text-xs mt-1 text-slate-700">Download songs from Soulseek</p>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {/* Artist albums view */}
            {!loading && !error && view === 'artist' && (
              <>
                {/* View toggle + sort */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50">
                  <select
                    value={albumsSort}
                    onChange={(e) => {
                      setAlbumsSort(e.target.value)
                      localStorage.setItem('sv-albums-sort', e.target.value)
                    }}
                    className="text-[10px] text-slate-400 bg-slate-900 border-none outline-none cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <option value="year-asc">Year ↑</option>
                    <option value="year-desc">Year ↓</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                  </select>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => {
                        setAlbumsView('list')
                        localStorage.setItem('sv-albums-view', 'list')
                      }}
                      title="List view"
                      className={`p-1.5 rounded transition-colors ${albumsView === 'list' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      <LayoutList size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setAlbumsView('grid')
                        localStorage.setItem('sv-albums-view', 'grid')
                      }}
                      title="Grid view"
                      className={`p-1.5 rounded transition-colors ${albumsView === 'grid' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      <LayoutGrid size={14} />
                    </button>
                  </div>
                </div>

                {albumsView === 'list' ? (
                  <ul className="py-1">
                    {sortedAlbums.map((album) => (
                      <li key={album.id}>
                        <button
                          onClick={() => goToAlbum(album)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 text-left transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-md bg-slate-800 flex-none overflow-hidden border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                            {album.coverArt ? (
                              <img
                                src={artUrl(album.coverArt, 80)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Disc size={16} className="text-slate-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 truncate">{album.name}</p>
                            <p className="text-xs text-slate-600">
                              {[album.year, album.songCount && `${album.songCount} tracks`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <ChevronRight
                            size={13}
                            className="text-slate-700 group-hover:text-slate-500 transition-colors flex-none"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid grid-cols-4 gap-1 p-2">
                    {sortedAlbums.map((album) => (
                      <button
                        key={album.id}
                        onClick={() => goToAlbum(album)}
                        className="flex flex-col gap-0 text-left group rounded-md p-1.5 hover:bg-slate-800/70 transition-colors"
                      >
                        <div className="aspect-square w-full rounded-sm bg-slate-800 overflow-hidden mb-1.5">
                          {album.coverArt ? (
                            <img
                              src={artUrl(album.coverArt, 100)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Disc size={10} className="text-slate-600" />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-300 truncate w-full leading-snug group-hover:text-white transition-colors">
                          {album.name}
                        </p>
                        {(album.year || album.songCount) && (
                          <p className="text-[9px] text-slate-500 truncate w-full leading-snug">
                            {[album.year, album.songCount && `${album.songCount}tr`]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Album tracks view */}
            {!loading && !error && view === 'album' && (
              <>
                {/* Tracks sort header */}
                <div className="flex items-center px-4 py-1 border-b border-slate-800/50 select-none">
                  <button
                    onClick={() => {
                      setTracksSort('track')
                      localStorage.setItem('sv-tracks-sort', 'track')
                    }}
                    className={`w-5 text-center mr-3 text-[10px] hover:text-slate-400 transition-colors ${tracksSort === 'track' ? 'text-emerald-400' : 'text-slate-600'}`}
                  >
                    #
                  </button>
                  <button
                    onClick={() => {
                      setTracksSort('title')
                      localStorage.setItem('sv-tracks-sort', 'title')
                    }}
                    className={`flex-1 text-left text-[10px] hover:text-slate-400 transition-colors ${tracksSort === 'title' ? 'text-emerald-400' : 'text-slate-600'}`}
                  >
                    Title
                  </button>
                  <button
                    onClick={() => {
                      setTracksSort('duration')
                      localStorage.setItem('sv-tracks-sort', 'duration')
                    }}
                    className={`text-[10px] hover:text-slate-400 transition-colors ${tracksSort === 'duration' ? 'text-emerald-400' : 'text-slate-600'}`}
                  >
                    Time
                  </button>
                  <div className="w-9" />
                </div>
                <ul className="py-1">
                  {sortedTracks.map((track, idx) => {
                    const isActive = player.song?.id === track.id
                    return (
                      <li
                        key={track.id}
                        className={`group relative flex items-center transition-colors ${isActive ? 'bg-emerald-900/20 hover:bg-emerald-900/25' : 'hover:bg-slate-800/50'}`}
                      >
                        <button
                          onClick={() => onPlay(track, tracks)}
                          className="flex-1 flex items-center gap-3 pl-4 pr-2 py-2.5 text-left min-w-0"
                        >
                          <span className="w-5 flex items-center justify-center flex-none">
                            {isActive && player.playing ? (
                              <span className="sv-eq">
                                <span />
                                <span />
                                <span />
                                <span />
                              </span>
                            ) : (
                              <span
                                className={`text-xs tabular-nums ${isActive ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'}`}
                              >
                                {track.track || idx + 1}
                              </span>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                            >
                              {track.title}
                            </p>
                          </div>
                        </button>

                        {/* Duration + 3-dot menu */}
                        <div className="flex items-center gap-1 pr-2 flex-none">
                          <span className="text-xs text-slate-600 tabular-nums">
                            {fmtDuration(track.duration)}
                          </span>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === track.id ? null : track.id)}
                            className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                            title="More options"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>

                        {openMenuId === track.id && (
                          <SongMenu
                            song={track}
                            onInfo={onShowInfo}
                            onDelete={setConfirmSong}
                            onAddToPlaylist={handleShowAddToPlaylist}
                            onClose={() => setOpenMenuId(null)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            {/* Search results view */}
            {!loading && !error && view === 'search' && searchResults && (
              <div className="py-2">
                {searchResults.artists.length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                      Artists
                    </p>
                    <ul>
                      {searchResults.artists.map((artist) => (
                        <li key={artist.id}>
                          <button
                            onClick={() => goToArtist(artist)}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 text-left transition-colors group"
                          >
                            <Mic2 size={13} className="text-slate-600 flex-none" />
                            <span className="text-sm text-slate-200 truncate">{artist.name}</span>
                            <ChevronRight size={12} className="text-slate-700 flex-none ml-auto" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {searchResults.albums.length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mt-2">
                      Albums
                    </p>
                    <ul>
                      {searchResults.albums.map((album) => (
                        <li key={album.id}>
                          <button
                            onClick={() => goToAlbum(album)}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 text-left transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-md bg-slate-800 flex-none overflow-hidden border border-slate-700/50">
                              {album.coverArt ? (
                                <img
                                  src={artUrl(album.coverArt, 64)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Disc size={13} className="text-slate-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-200 truncate">{album.name}</p>
                              <p className="text-xs text-slate-600 truncate">{album.artist}</p>
                            </div>
                            <ChevronRight size={12} className="text-slate-700 flex-none" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {searchResults.songs.length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mt-2">
                      Songs
                    </p>
                    <ul>
                      {searchResults.songs.map((song) => {
                        const isActive = player.song?.id === song.id
                        return (
                          <li
                            key={song.id}
                            className={`group relative flex items-center transition-colors ${isActive ? 'bg-emerald-900/20' : 'hover:bg-slate-800/50'}`}
                          >
                            <button
                              onClick={() => onPlay(song, searchResults.songs)}
                              className="flex-1 flex items-center gap-3 pl-4 pr-2 py-2 text-left min-w-0"
                            >
                              {isActive && player.playing ? (
                                <span className="sv-eq flex-none">
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                </span>
                              ) : (
                                <Music
                                  size={12}
                                  className={`flex-none ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                                >
                                  {song.title}
                                </p>
                                <p className="text-xs text-slate-600 truncate">
                                  {song.artist}
                                  {song.album ? ` · ${song.album}` : ''}
                                </p>
                              </div>
                            </button>

                            {/* Duration + 3-dot menu */}
                            <div className="flex items-center gap-1 pr-2 flex-none">
                              <span className="text-xs text-slate-600 tabular-nums">
                                {fmtDuration(song.duration)}
                              </span>
                              <button
                                onClick={() =>
                                  setOpenMenuId(openMenuId === song.id ? null : song.id)
                                }
                                className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                                title="More options"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </div>

                            {openMenuId === song.id && (
                              <SongMenu
                                song={song}
                                onInfo={onShowInfo}
                                onDelete={setConfirmSong}
                                onAddToPlaylist={handleShowAddToPlaylist}
                                onClose={() => setOpenMenuId(null)}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}

                {searchResults.artists.length === 0 &&
                  searchResults.albums.length === 0 &&
                  searchResults.songs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                      <Search size={28} strokeWidth={1.5} />
                      <p className="text-sm">No results found</p>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* ── Playlists section ───────────────────────────── */}
        {section === 'playlists' && (
          <>
            {/* Loading */}
            {playlists.loading && (
              <div className="flex justify-center items-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
              </div>
            )}

            {/* Error */}
            {!playlists.loading && playlists.error && (
              <div className="m-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={15} className="flex-none mt-0.5" />
                <span>{playlists.error}</span>
              </div>
            )}

            {/* Playlist list */}
            {!playlists.loading && !playlists.error && playlists.view === 'list' && (
              <ul className="py-1">
                {playlists.playlists.map((pl) => (
                  <li
                    key={pl.id}
                    className="group relative flex items-center transition-colors hover:bg-slate-800/50"
                  >
                    <button
                      onClick={() => playlists.openPlaylist(pl)}
                      className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left min-w-0"
                    >
                      <ListMusic size={13} className="text-slate-600 flex-none" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{pl.name}</p>
                        <p className="text-xs text-slate-600">
                          {pl.songCount ?? 0} {pl.songCount === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                      <ChevronRight
                        size={13}
                        className="text-slate-700 group-hover:text-slate-500 transition-colors flex-none"
                      />
                    </button>
                    <button
                      onClick={() => setPlaylistMenuId(playlistMenuId === pl.id ? null : pl.id)}
                      className="p-1.5 mr-2 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100 flex-none"
                      title="More options"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {playlistMenuId === pl.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setPlaylistMenuId(null)}
                        />
                        <div className="absolute right-2 top-full mt-1 z-50 min-w-[140px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                          <button
                            onClick={() => {
                              setRenamingPlaylist(pl)
                              setRenameValue(pl.name)
                              setPlaylistMenuId(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
                          >
                            <Pencil size={13} className="text-slate-400 flex-none" />
                            Rename
                          </button>
                          <button
                            onClick={async () => {
                              setPlaylistMenuId(null)
                              await playlists.remove(pl.id, playlists.currentPlaylist)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors text-left"
                          >
                            <Trash2 size={13} className="flex-none" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}

                {playlists.playlists.length === 0 && (
                  <li className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <ListMusic size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm">No playlists yet</p>
                      <p className="text-xs mt-1">Add songs via the ··· menu</p>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {/* Playlist detail */}
            {!playlists.loading && !playlists.error && playlists.view === 'detail' && (
              <>
                {/* Playlist info header */}
                <div className="px-4 pt-3 pb-2 border-b border-slate-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-slate-200 truncate">
                      {playlists.currentPlaylist?.name}
                    </h2>
                    <div className="relative flex-none">
                      <button
                        onClick={() => setPlaylistDetailMenuOpen((v) => !v)}
                        className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                        title="Playlist actions"
                      >
                        <MoreHorizontal size={13} />
                      </button>

                      {playlistDetailMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setPlaylistDetailMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                            <button
                              onClick={() => {
                                setRenamingPlaylist(playlists.currentPlaylist)
                                setRenameValue(playlists.currentPlaylist?.name || '')
                                setPlaylistDetailMenuOpen(false)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-left"
                            >
                              <Pencil size={13} className="text-slate-400 flex-none" />
                              Rename
                            </button>
                            <button
                              onClick={async () => {
                                await playlists.remove(
                                  playlists.currentPlaylist?.id,
                                  playlists.currentPlaylist
                                )
                                setPlaylistDetailMenuOpen(false)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors text-left"
                            >
                              <Trash2 size={13} className="flex-none" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {playlists.tracks.length} {playlists.tracks.length === 1 ? 'track' : 'tracks'}
                  </p>
                </div>

                {playlists.tracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <Music size={28} strokeWidth={1.5} />
                    <p className="text-sm text-center px-4">
                      No songs yet — add songs via the ··· menu
                    </p>
                  </div>
                ) : (
                  <ul className="py-1">
                    {playlists.tracks.map((track, idx) => {
                      const isActive = player.song?.id === track.id
                      return (
                        <li
                          key={`${track.id}-${idx}`}
                          className={`group relative flex items-center transition-colors ${isActive ? 'bg-emerald-900/20 hover:bg-emerald-900/25' : 'hover:bg-slate-800/50'}`}
                        >
                          <button
                            onClick={() => onPlay(track, playlists.tracks)}
                            className="flex-1 flex items-center gap-3 pl-4 pr-2 py-2.5 text-left min-w-0"
                          >
                            <span className="w-5 flex items-center justify-center flex-none">
                              {isActive && player.playing ? (
                                <span className="sv-eq">
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                </span>
                              ) : (
                                <span
                                  className={`text-xs tabular-nums ${isActive ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'}`}
                                >
                                  {idx + 1}
                                </span>
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                              >
                                {track.title}
                              </p>
                              <p className="text-xs text-slate-600 truncate">
                                {track.artist}
                                {track.album ? ` · ${track.album}` : ''}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 pr-2 flex-none">
                            <span className="text-xs text-slate-600 tabular-nums">
                              {fmtDuration(track.duration)}
                            </span>
                            <button
                              onClick={() =>
                                setOpenPlaylistTrackMenuId(
                                  openPlaylistTrackMenuId === `${track.id}-${idx}`
                                    ? null
                                    : `${track.id}-${idx}`
                                )
                              }
                              className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                              title="More options"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>

                          {openPlaylistTrackMenuId === `${track.id}-${idx}` && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenPlaylistTrackMenuId(null)}
                              />
                              <div className="absolute right-2 top-full mt-1 z-50 min-w-[180px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                                <button
                                  onClick={async () => {
                                    await playlists.removeTrack(
                                      playlists.currentPlaylist?.id,
                                      idx,
                                      playlists.currentPlaylist
                                    )
                                    setOpenPlaylistTrackMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors text-left"
                                >
                                  <Trash2 size={13} className="flex-none" />
                                  Remove from playlist
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Rename playlist modal */}
      {renamingPlaylist && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setRenamingPlaylist(null)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[22vh] px-4">
            <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4">
              <p className="text-sm font-medium text-slate-200 mb-3">Rename playlist</p>
              <form onSubmit={handleRenamePlaylist} className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setRenamingPlaylist(null)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                  >
                    Rename
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add to playlist picker */}
      {addToPlaylistSong && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setAddToPlaylistSong(null)}
          />
          <div className="fixed inset-x-4 top-1/4 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-700">
              Add to playlist
            </p>
            {playlists.loading ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
              </div>
            ) : (
              <ul className="max-h-48 overflow-y-auto">
                {playlists.playlists.map((pl) => (
                  <li key={pl.id}>
                    <button
                      onClick={() => handleAddToPlaylist(pl.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 text-left transition-colors"
                    >
                      <ListMusic size={13} className="text-slate-500 flex-none" />
                      {pl.name}
                    </button>
                  </li>
                ))}
                {playlists.playlists.length === 0 && (
                  <li className="px-4 py-3 text-xs text-slate-600">No playlists yet</li>
                )}
              </ul>
            )}
            <div className="border-t border-slate-700">
              {addToPlaylistCreating ? (
                <form onSubmit={handleAddToPlaylistNew} className="flex items-center gap-2 p-2">
                  <input
                    autoFocus
                    value={addToPlaylistNewName}
                    onChange={(e) => setAddToPlaylistNewName(e.target.value)}
                    placeholder="Playlist name…"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                  />
                  <button
                    type="submit"
                    className="text-xs text-emerald-400 hover:text-emerald-300 px-1 flex-none"
                  >
                    Create
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddToPlaylistCreating(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 text-left transition-colors"
                >
                  <Plus size={13} className="flex-none" />
                  New playlist
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmSong && (
        <DeleteConfirmModal
          song={confirmSong}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmSong(null)}
          deleting={deleting}
        />
      )}
    </section>
  )
}
