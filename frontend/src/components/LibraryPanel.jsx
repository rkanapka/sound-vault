import { useState } from 'react'
import { Search, RefreshCw, Music, Disc, ChevronRight, Mic2, AlertCircle } from 'lucide-react'
import { artUrl } from '../api'
import Breadcrumb from './Breadcrumb'

function fmtDuration(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LibraryPanel({ library, player, onPlay }) {
  const {
    view,
    artists,
    currentArtist,
    albums,
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
  } = library

  const [libQuery, setLibQuery] = useState('')

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
            onClick={scan}
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
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-none border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                    <Mic2
                      size={12}
                      className="text-slate-500 group-hover:text-emerald-400 transition-colors"
                    />
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
        )}

        {/* Album tracks view */}
        {!loading && !error && view === 'album' && (
          <ul className="py-1">
            {tracks.map((track, idx) => {
              const isActive = player.song?.id === track.id
              return (
                <li key={track.id}>
                  <button
                    onClick={() => onPlay(track, tracks)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group
                      ${isActive ? 'bg-emerald-900/20 hover:bg-emerald-900/25' : 'hover:bg-slate-800/50'}
                    `}
                  >
                    <span
                      className={`w-5 text-xs text-right flex-none tabular-nums
                        ${isActive ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'}
                      `}
                    >
                      {isActive && player.playing ? '▶' : track.track || idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                      >
                        {track.title}
                      </p>
                    </div>
                    <span className="text-xs text-slate-600 flex-none tabular-nums">
                      {fmtDuration(track.duration)}
                    </span>
                  </button>
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
                      <li key={song.id}>
                        <button
                          onClick={() => onPlay(song, searchResults.songs)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2 text-left transition-colors group
                            ${isActive ? 'bg-emerald-900/20' : 'hover:bg-slate-800/50'}
                          `}
                        >
                          <Music
                            size={12}
                            className={isActive ? 'text-emerald-400' : 'text-slate-600'}
                          />
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
                          <span className="text-xs text-slate-600 flex-none tabular-nums">
                            {fmtDuration(song.duration)}
                          </span>
                        </button>
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
    </section>
  )
}
