import { useState, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Music,
  Disc,
  ChevronRight,
  Mic2,
  AlertCircle,
  MoreHorizontal,
  LayoutGrid,
  LayoutList,
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

export default function LibraryPanel({ library, player, onPlay, onShowInfo }) {
  const {
    view,
    artists,
    albums,
    currentAlbum,
    tracks,
    searchResults,
    breadcrumbs,
    loading,
    error,
    scanning,
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

  const reloadView = useCallback(() => {
    if (view === 'album' && currentAlbum) goToAlbum(currentAlbum)
    else if (view === 'search') searchLib(libQuery)
    else loadArtists()
  }, [view, currentAlbum, goToAlbum, searchLib, libQuery, loadArtists])

  const handleSearch = (e) => {
    e.preventDefault()
    searchLib(libQuery)
  }

  const handleBreadcrumb = (action) => {
    if (action === 'artists') {
      setLibQuery('')
      loadArtists()
    } else if (action === 'artist') {
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

  return (
    <section className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex-none p-3 border-b border-slate-800">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">
          Library
        </p>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
            {/* View toggle */}
            <div className="flex items-center justify-end px-3 py-1.5 border-b border-slate-800/50">
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
                {albums.map((album) => (
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
                {albums.map((album) => (
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
          <ul className="py-1">
            {tracks.map((track, idx) => {
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
                      onClose={() => setOpenMenuId(null)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
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
                            onClick={() => setOpenMenuId(openMenuId === song.id ? null : song.id)}
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
      </div>

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
