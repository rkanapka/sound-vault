import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Search,
  RefreshCw,
  Music,
  Disc,
  Compass,
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
  Heart,
  Radio,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { artUrl, deleteSong } from '../api'
import Breadcrumb from './Breadcrumb'
import SongMenu from './SongMenu'
import DeleteConfirmModal from './DeleteConfirmModal'
import { getItemArtTarget, getSongArtTarget, getSongListArtTarget } from '../utils/artwork'
import { getDiscoverCardImage } from '../utils/discover'

function fmtDuration(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtCount(value) {
  if (value == null) return null
  return new Intl.NumberFormat().format(value)
}

function normalizeArtistName(name) {
  return name?.trim().toLocaleLowerCase() ?? ''
}

function getArtSrc(item, size) {
  const art = getItemArtTarget(item)
  return art ? artUrl(art.id, size, art.cacheKey) : null
}

function getSongArtSrc(song, size) {
  const art = getSongListArtTarget(song)
  return art ? artUrl(art.id, size, art.cacheKey) : null
}

function getAlbumTrackArtSrc(song, size) {
  const art = getSongArtTarget(song)
  return art ? artUrl(art.id, size, art.cacheKey) : null
}

function ExpandableText({ text, expanded, onToggle, previewLength = 320 }) {
  const normalized = text?.trim()
  if (!normalized) return null

  const isLong = normalized.length > previewLength
  const displayText =
    expanded || !isLong ? normalized : `${normalized.slice(0, previewLength).trimEnd()}...`

  return (
    <div className="mt-2">
      <p className="text-xs leading-5 text-slate-400 whitespace-pre-line">{displayText}</p>
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function HomeActionTile({ label, title, meta, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[1.4rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(20,24,31,0.88),rgba(10,13,18,0.96))] px-4 py-4 text-left transition-colors hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-100">{title}</p>
          {meta && <p className="mt-1.5 text-xs text-slate-500">{meta}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 text-slate-300">
          <Icon size={15} />
        </div>
      </div>
    </button>
  )
}

function discoverTagMetric(tag) {
  return tag?.reach ?? tag?.count ?? null
}

function DiscoverTagPill({ tag, onClick }) {
  return (
    <button
      onClick={() => onClick(tag.name)}
      className="rounded-full border border-slate-800/70 bg-slate-900/40 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-emerald-400/30 hover:text-emerald-100"
    >
      <span>{tag.name}</span>
      {discoverTagMetric(tag) != null && (
        <span className="ml-1.5 text-[10px] text-slate-500">
          {fmtCount(discoverTagMetric(tag))}
        </span>
      )}
    </button>
  )
}

function CompactDiscoverItem({ card, onClick, rank }) {
  const imageSrc = getDiscoverCardImage(card, 96)
  const subtitle = card.artistName || (card.inLibrary ? 'In your library' : 'Discover more')
  const actionLabel = 'Details'

  return (
    <button
      onClick={() => onClick(card)}
      className="group grid w-full grid-cols-[2rem_2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-950/35 px-2.5 py-2 text-left transition-colors hover:border-slate-600 hover:bg-slate-900/60"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800/70 bg-slate-900/70 text-[11px] font-semibold text-slate-400">
        {String(rank).padStart(2, '0')}
      </div>
      <div className="h-11 w-11 flex-none overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/80">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_55%,#020617_100%)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-slate-100 truncate">{card.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors group-hover:text-slate-300">
        <span>{actionLabel}</span>
        <ChevronRight size={12} />
      </span>
    </button>
  )
}

const favoritesListGridTemplate = '1.25rem 2rem minmax(0, 1.7fr) minmax(8rem, 1fr) auto 4.25rem'
const playlistListGridTemplate = '1.25rem 2rem minmax(0, 1.7fr) minmax(8rem, 1fr) auto 2.5rem'
const compactAlbumGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2 p-2'

export default function LibraryPanel({
  library,
  player,
  onPlay,
  onShowInfo,
  playlists,
  favorites,
  discover,
  section,
  onNavigate,
  onOpenDiscoverGlobal,
  onOpenDiscoverTag,
  onOpenDiscoverDetail,
  onSearchSoulseek,
}) {
  const {
    view,
    browseTab,
    newestAlbums,
    recentAlbums,
    artists,
    currentArtist,
    albums,
    allAlbums,
    allAlbumsHasMore,
    loadingMoreAlbums,
    currentAlbum,
    currentAlbumOrigin,
    tracks,
    searchResults,
    breadcrumbs,
    loading,
    error,
    scanning,
    loadHome,
    openLibrary,
    loadArtists,
    loadAlbums,
    loadMoreAlbums,
    ensureAllAlbumsLoaded,
    goToArtist,
    goToAlbum,
    goBackToArtist,
    openSearchResults,
    exitSearch,
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
  const [artistBioExpanded, setArtistBioExpanded] = useState(false)
  const [albumDescriptionExpanded, setAlbumDescriptionExpanded] = useState(false)

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

  const trackArtists = useMemo(() => {
    const artistsByKey = new Map()
    tracks.forEach((track) => {
      const artist = track.artist?.trim()
      const normalizedArtist = normalizeArtistName(artist)
      if (!normalizedArtist || artistsByKey.has(normalizedArtist)) return
      artistsByKey.set(normalizedArtist, artist)
    })
    return Array.from(artistsByKey.values()).sort((a, b) => a.localeCompare(b))
  }, [tracks])

  const albumTrackCount = currentAlbum?.songCount ?? tracks.length
  const albumMeta = [
    currentAlbum?.year,
    albumTrackCount ? `${albumTrackCount} ${albumTrackCount === 1 ? 'track' : 'tracks'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const isCompilationAlbum =
    normalizeArtistName(currentAlbum?.artist) === 'various artists' || trackArtists.length > 1

  const normalizedLibQuery = libQuery.trim().toLocaleLowerCase()
  const filteredArtists = useMemo(() => {
    if (!normalizedLibQuery) return artists
    return artists.filter((artist) => artist.name?.toLocaleLowerCase().includes(normalizedLibQuery))
  }, [artists, normalizedLibQuery])

  const filteredAllAlbums = useMemo(() => {
    if (!normalizedLibQuery) return allAlbums
    return allAlbums.filter((album) => {
      const albumName = album.name?.toLocaleLowerCase() ?? ''
      const albumArtist = album.artist?.toLocaleLowerCase() ?? ''
      return albumName.includes(normalizedLibQuery) || albumArtist.includes(normalizedLibQuery)
    })
  }, [allAlbums, normalizedLibQuery])

  const activeLibraryTab =
    view === 'artists' || view === 'artist' ? 'artists' : view === 'albums' ? 'albums' : browseTab
  const librarySearchPlaceholder =
    section === 'home'
      ? 'Search library…'
      : activeLibraryTab === 'albums'
        ? 'Filter albums…'
        : 'Filter artists…'

  useEffect(() => {
    if (
      section !== 'library' ||
      activeLibraryTab !== 'albums' ||
      view !== 'albums' ||
      !normalizedLibQuery
    )
      return
    ensureAllAlbumsLoaded()
  }, [section, activeLibraryTab, view, normalizedLibQuery, ensureAllAlbumsLoaded])

  useEffect(() => {
    setArtistBioExpanded(false)
  }, [currentArtist?.id])

  useEffect(() => {
    setAlbumDescriptionExpanded(false)
  }, [currentAlbum?.id])

  const reloadView = useCallback(() => {
    if (view === 'album' && currentAlbum) goToAlbum(currentAlbum, { origin: currentAlbumOrigin })
    else if (view === 'search' && libQuery.trim()) searchLib(libQuery)
    else if (view === 'artist' && currentArtist) goToArtist(currentArtist)
    else if (view === 'albums') loadAlbums({ force: true })
    else if (view === 'artists') loadArtists({ force: true })
    else if (view === 'home') loadHome()
    else openLibrary({ force: true })
  }, [
    view,
    currentAlbum,
    currentAlbumOrigin,
    goToAlbum,
    searchLib,
    libQuery,
    currentArtist,
    goToArtist,
    loadAlbums,
    loadArtists,
    loadHome,
    openLibrary,
  ])

  const handleSearch = async (e) => {
    e.preventDefault()
    onNavigate('library')
    if (!libQuery.trim()) {
      await exitSearch()
      return
    }
    searchLib(libQuery)
  }

  const handleLibraryQueryChange = async (e) => {
    const nextQuery = e.target.value
    setLibQuery(nextQuery)
    if (!nextQuery.trim() && (view === 'search' || currentAlbumOrigin?.type === 'search')) {
      await exitSearch()
    }
  }

  const handleLibraryTabChange = (tab) => {
    onNavigate('library')
    if (tab === 'albums') loadAlbums()
    else loadArtists()
  }

  const handleBreadcrumb = (action) => {
    if (action === 'home') {
      onNavigate('home')
      setLibQuery('')
      loadHome()
    } else if (action === 'artists') {
      onNavigate('library')
      loadArtists()
    } else if (action === 'albums') {
      onNavigate('library')
      loadAlbums()
    } else if (action === 'artist') {
      onNavigate('library')
      goBackToArtist()
    } else if (action === 'search') {
      onNavigate('library')
      openSearchResults()
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

  const openAlbumFromHome = (album) => {
    onNavigate('library')
    goToAlbum(album, { origin: 'albums' })
  }

  const homeDiscoverEnabled = Boolean(discover?.enabled)
  const homeTrendingArtists = discover?.trendingArtists || []
  const homeTrendingTracks = discover?.trendingTracks || []
  const homeTopTags = discover?.topTags || []

  const handleHomeDiscoverCard = async (card) => {
    if (!card) return
    await onOpenDiscoverDetail?.(card)
  }

  const openAlbumFromTrack = (track) => {
    if (!track?.albumId) return
    onNavigate('library')
    goToAlbum({ id: track.albumId }, { origin: 'albums' })
  }

  return (
    <section className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex-none p-3 border-b border-slate-800">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">
          {section === 'playlists' || section === 'favorites' ? 'Playlists' : 'Library'}
        </p>

        {section !== 'playlists' && section !== 'favorites' ? (
          <>
            <div className="flex gap-2">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  value={libQuery}
                  onChange={handleLibraryQueryChange}
                  placeholder={librarySearchPlaceholder}
                  className="sv-search-input flex-1 rounded-lg px-3 py-2 text-sm transition-colors"
                />
                <button
                  type="submit"
                  title="Search all library"
                  className="sv-search-btn flex-none flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
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

            {section === 'library' && (
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="inline-flex rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5">
                  {[
                    ['artists', 'Artists'],
                    ['albums', 'Albums'],
                  ].map(([tabId, label]) => (
                    <button
                      key={tabId}
                      onClick={() => handleLibraryTabChange(tabId)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        activeLibraryTab === tabId
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-500 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {view === 'search' && (
                  <button
                    onClick={() => {
                      setLibQuery('')
                      exitSearch()
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    Back to {browseTab === 'albums' ? 'Albums' : 'Artists'}
                  </button>
                )}
              </div>
            )}

            {breadcrumbs.length > 0 && (
              <div className="mt-2.5">
                <Breadcrumb crumbs={breadcrumbs} onNavigate={handleBreadcrumb} />
              </div>
            )}
          </>
        ) : section === 'favorites' ? (
          <button
            onClick={() => onNavigate('playlists')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronLeft size={12} />
            Playlists
          </button>
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
              className="sv-search-input flex-1 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="sv-btn-primary text-xs px-2.5 py-1.5 rounded-md flex-none transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreatePlaylistMode(false)}
              className="sv-btn-secondary text-xs px-2.5 py-1.5 rounded-md flex-none transition-colors"
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
        {section !== 'playlists' && section !== 'favorites' && (
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
              <div className="px-4 py-4 space-y-6">
                <section className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(14rem,0.95fr)]">
                  <button
                    onClick={() => onOpenDiscoverGlobal?.('artists')}
                    className="overflow-hidden rounded-[1.8rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(24,30,24,0.94),rgba(24,18,15,0.78)_45%,rgba(8,11,16,0.98))] p-5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.3)] transition-colors hover:border-emerald-400/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                          <Compass size={12} />
                          Discover
                        </div>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
                          Global Tops
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                          Browse Last.fm&apos;s top artists, tracks, and tags, then open local
                          matches instantly or jump to Soulseek for anything missing.
                        </p>
                      </div>
                      <div className="flex min-w-[12rem] flex-col gap-2 rounded-[1.4rem] border border-white/8 bg-black/20 p-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-2 text-emerald-100">
                          <Radio size={13} />
                          Anonymous charts
                        </span>
                        <span>
                          {homeDiscoverEnabled
                            ? `${homeTrendingArtists.length} artists and ${homeTrendingTracks.length} tracks ready from the global feed.`
                            : 'Add LASTFM_API_KEY to enable discovery signals.'}
                        </span>
                        <span className="inline-flex items-center gap-2 text-slate-300">
                          Open Discover
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    <HomeActionTile
                      label="Library"
                      title="Browse your collection"
                      meta="Artists, albums, and search"
                      icon={Music}
                      onClick={() => {
                        onNavigate('library')
                        openLibrary()
                      }}
                    />
                    <HomeActionTile
                      label="Playlists"
                      title="Open your playlists"
                      meta={`${playlists.playlists.length} saved collections`}
                      icon={ListMusic}
                      onClick={() => {
                        playlists.backToList()
                        playlists.loadPlaylists()
                        onNavigate('playlists')
                      }}
                    />
                    <HomeActionTile
                      label="Favorites"
                      title="Jump into liked songs"
                      meta={`${favorites?.songs.length ?? 0} saved tracks`}
                      icon={Heart}
                      onClick={() => {
                        favorites.load()
                        onNavigate('favorites')
                      }}
                    />
                  </div>
                </section>

                {homeDiscoverEnabled ? (
                  <section className="overflow-hidden rounded-[1.6rem] border border-slate-800/70 bg-[linear-gradient(165deg,rgba(15,23,42,0.78),rgba(9,12,16,0.96))] shadow-[0_22px_54px_rgba(0,0,0,0.24)]">
                    <div className="border-b border-slate-800/70 px-4 py-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
                            Trending Now
                          </p>
                          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">
                            Fast discovery, lighter scan
                          </h3>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-400">
                          Open local matches instantly, or jump out to Soulseek when something is
                          missing from your library.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                              Trending Artists
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Four quick artist picks from the global feed.
                            </p>
                          </div>
                          <button
                            onClick={() => onOpenDiscoverGlobal?.('artists')}
                            className="text-[11px] font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                          >
                            Browse artists
                          </button>
                        </div>
                        {homeTrendingArtists.length > 0 ? (
                          <div className="space-y-2">
                            {homeTrendingArtists.slice(0, 4).map((card, index) => (
                              <CompactDiscoverItem
                                key={`home-artist-${card.title}`}
                                card={card}
                                rank={index + 1}
                                onClick={handleHomeDiscoverCard}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700">No artist chart data right now.</p>
                        )}
                      </div>

                      <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                              Trending Tracks
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Preview what is landing globally before diving deeper.
                            </p>
                          </div>
                          <button
                            onClick={() => onOpenDiscoverGlobal?.('tracks')}
                            className="text-[11px] font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                          >
                            Browse tracks
                          </button>
                        </div>
                        {homeTrendingTracks.length > 0 ? (
                          <div className="space-y-2">
                            {homeTrendingTracks.slice(0, 4).map((card, index) => (
                              <CompactDiscoverItem
                                key={`home-track-${card.artistName}-${card.title}`}
                                card={card}
                                rank={index + 1}
                                onClick={handleHomeDiscoverCard}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700">No track chart data right now.</p>
                        )}
                      </div>

                      <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                              Tags
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Jump straight into genre lanes instead of the global stream.
                            </p>
                          </div>
                          <button
                            onClick={() => onOpenDiscoverTag?.(homeTopTags[0]?.name || 'rock')}
                            className="text-[11px] font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                          >
                            Browse tags
                          </button>
                        </div>
                        {homeTopTags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {homeTopTags.slice(0, 8).map((tag) => (
                              <DiscoverTagPill
                                key={`home-tag-${tag.name}`}
                                tag={tag}
                                onClick={(tagName) => onOpenDiscoverTag?.(tagName)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700">No tags available right now.</p>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
                  <div className="rounded-[1.5rem] border border-slate-800/70 bg-[linear-gradient(160deg,rgba(17,24,39,0.8),rgba(9,11,16,0.92))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-200">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          Last.fm discovery is disabled
                        </p>
                        <p className="mt-1.5 text-sm text-slate-500">
                          Add <code className="text-slate-300">LASTFM_API_KEY</code> to unlock
                          global charts, tags, and recommendation rows on Home.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      Playlists
                    </p>
                  </div>
                  {playlists.loading ? (
                    <div className="py-2">
                      <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        onClick={() => onNavigate('favorites')}
                        className="flex-none min-w-[150px] rounded-lg border border-slate-700/60 bg-gradient-to-br from-slate-800/80 to-slate-800/30 px-3 py-3 text-left hover:border-slate-500 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Heart size={12} className="text-pink-400 flex-none" />
                          <p className="text-xs text-slate-100 truncate">Liked Songs</p>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {favorites?.songs.length ?? 0}{' '}
                          {(favorites?.songs.length ?? 0) === 1 ? 'track' : 'tracks'}
                        </p>
                      </button>
                      {playlists.playlists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => openPlaylistFromHome(pl)}
                          className="flex-none min-w-[150px] rounded-lg border border-slate-700/60 bg-gradient-to-br from-slate-800/80 to-slate-800/30 px-3 py-3 text-left hover:border-slate-500 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ListMusic size={12} className="text-emerald-500/70 flex-none" />
                            <p className="text-xs text-slate-100 truncate">{pl.name}</p>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-500">
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
                  <div key={label}>
                    <p className="mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {label}
                    </p>
                    {list.length === 0 ? (
                      <p className="text-xs text-slate-700">Nothing here yet</p>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {list.map((album) => (
                          <button
                            key={album.id}
                            onClick={() => openAlbumFromHome(album)}
                            className="flex-none w-24 group text-left"
                          >
                            <div className="w-24 h-24 rounded-md bg-slate-800 overflow-hidden border border-slate-700/50 group-hover:border-slate-500 transition-colors mb-1.5 shadow-sm">
                              {getArtSrc(album, 192) ? (
                                <img
                                  src={getArtSrc(album, 192)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Disc size={20} className="text-slate-600" />
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 truncate leading-snug group-hover:text-white transition-colors">
                              {album.name}
                            </p>
                            <p className="text-[10px] text-slate-600 truncate leading-snug">
                              {album.artist}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Artists view */}
            {!loading && !error && view === 'artists' && (
              <ul className="py-1">
                {filteredArtists.map((artist) => (
                  <li key={artist.id}>
                    <button
                      onClick={() => goToArtist(artist)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-none border border-slate-700/50 group-hover:border-slate-600 transition-colors overflow-hidden">
                        {getArtSrc(artist, 56) ? (
                          <img
                            src={getArtSrc(artist, 56)}
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
                {artists.length > 0 && filteredArtists.length === 0 && (
                  <li className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <Mic2 size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm">No artists match</p>
                      <p className="text-xs mt-1 text-slate-700">Try a different filter</p>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {/* Global albums view */}
            {!loading && !error && view === 'albums' && (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {normalizedLibQuery ? `${filteredAllAlbums.length} matches` : 'All Albums'}
                  </p>
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

                {filteredAllAlbums.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <Disc size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm">
                        {allAlbums.length === 0 ? 'No albums yet' : 'No albums match'}
                      </p>
                      <p className="text-xs mt-1 text-slate-700">
                        {allAlbums.length === 0
                          ? 'Download songs from Soulseek'
                          : 'Try a different filter'}
                      </p>
                    </div>
                  </div>
                ) : albumsView === 'list' ? (
                  <ul className="py-1">
                    {filteredAllAlbums.map((album) => (
                      <li key={album.id}>
                        <button
                          onClick={() => goToAlbum(album, { origin: 'albums' })}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 text-left transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-md bg-slate-800 flex-none overflow-hidden border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                            {getArtSrc(album, 80) ? (
                              <img
                                src={getArtSrc(album, 80)}
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
                            <p className="text-xs text-slate-600 truncate">
                              {[album.artist, album.year].filter(Boolean).join(' · ')}
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
                  <div className={compactAlbumGridClass}>
                    {filteredAllAlbums.map((album) => (
                      <button
                        key={album.id}
                        onClick={() => goToAlbum(album, { origin: 'albums' })}
                        className="flex flex-col gap-0 text-left group rounded-md p-1 hover:bg-slate-800/70 transition-colors"
                      >
                        <div className="aspect-square w-full rounded-md bg-slate-800 overflow-hidden mb-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
                          {getArtSrc(album, 160) ? (
                            <img
                              src={getArtSrc(album, 160)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Disc size={14} className="text-slate-600" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 truncate w-full leading-snug group-hover:text-white transition-colors">
                          {album.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate w-full leading-snug">
                          {[album.artist, album.year].filter(Boolean).join(' · ')}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {(allAlbumsHasMore || loadingMoreAlbums) && (
                  <div className="px-4 py-3 border-t border-slate-800/40 flex justify-center">
                    <button
                      onClick={() => loadMoreAlbums()}
                      disabled={loadingMoreAlbums}
                      className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                        loadingMoreAlbums
                          ? 'bg-slate-800 text-slate-600 cursor-default'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {loadingMoreAlbums ? 'Loading…' : 'Load more albums'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Artist albums view */}
            {!loading && !error && view === 'artist' && (
              <>
                <div className="px-4 py-4 border-b border-slate-800/40 bg-slate-900/30">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50 flex-none shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                      {getArtSrc(currentArtist, 128) ? (
                        <img
                          src={getArtSrc(currentArtist, 128)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Mic2 size={22} className="text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-medium text-slate-100 truncate">
                        {currentArtist?.name || 'Artist'}
                      </h2>
                      {currentArtist?.albumCount > 0 && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {currentArtist.albumCount} album
                          {currentArtist.albumCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      <ExpandableText
                        text={currentArtist?.biography}
                        expanded={artistBioExpanded}
                        onToggle={() => setArtistBioExpanded((value) => !value)}
                      />
                    </div>
                  </div>
                </div>

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
                            {getArtSrc(album, 80) ? (
                              <img
                                src={getArtSrc(album, 80)}
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
                  <div className={compactAlbumGridClass}>
                    {sortedAlbums.map((album) => (
                      <button
                        key={album.id}
                        onClick={() => goToAlbum(album)}
                        className="flex flex-col gap-0 text-left group rounded-md p-1 hover:bg-slate-800/70 transition-colors"
                      >
                        <div className="aspect-square w-full rounded-md bg-slate-800 overflow-hidden mb-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
                          {getArtSrc(album, 160) ? (
                            <img
                              src={getArtSrc(album, 160)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Disc size={14} className="text-slate-600" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 truncate w-full leading-snug group-hover:text-white transition-colors">
                          {album.name}
                        </p>
                        {(album.year || album.songCount) && (
                          <p className="text-[10px] text-slate-500 truncate w-full leading-snug">
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
                <div className="px-4 py-3 border-b border-slate-800/40 bg-slate-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-md bg-slate-800 overflow-hidden border border-slate-700/50 flex-none shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        {getArtSrc(currentAlbum, 240) ? (
                          <img
                            src={getArtSrc(currentAlbum, 240)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Disc size={22} className="text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h2 className="text-sm font-medium text-slate-100 truncate">
                          {currentAlbum?.name || 'Album'}
                        </h2>
                        {currentAlbum?.artist && (
                          <p className="mt-0.5 text-sm text-slate-400 truncate">
                            {currentAlbum.artist}
                          </p>
                        )}
                        {albumMeta && <p className="mt-1 text-xs text-slate-500">{albumMeta}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {currentAlbum?.genre && (
                            <span className="px-2 py-1 rounded-full border border-slate-700 bg-slate-800/80 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                              {currentAlbum.genre}
                            </span>
                          )}
                        </div>
                        <ExpandableText
                          text={currentAlbum?.description}
                          expanded={albumDescriptionExpanded}
                          onToggle={() => setAlbumDescriptionExpanded((value) => !value)}
                        />
                      </div>
                    </div>
                    {(isCompilationAlbum || trackArtists.length > 1) && (
                      <div className="flex flex-wrap justify-end gap-1 flex-none">
                        {isCompilationAlbum && (
                          <span className="px-2 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            Compilation
                          </span>
                        )}
                        {trackArtists.length > 1 && (
                          <span className="px-2 py-1 rounded-full border border-slate-700 bg-slate-800/80 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                            {trackArtists.length} artists
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

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
                          data-spacebar-play-toggle
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
                          {isCompilationAlbum && (
                            <div className="w-8 h-8 rounded bg-slate-800 flex-none overflow-hidden border border-slate-700/50">
                              {getAlbumTrackArtSrc(track, 64) ? (
                                <img
                                  src={getAlbumTrackArtSrc(track, 64)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Mic2 size={12} className="text-slate-600" />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                            >
                              {track.title}
                            </p>
                            {isCompilationAlbum && track.artist?.trim() && (
                              <p
                                className={`text-xs truncate mt-0.5 ${
                                  isActive ? 'text-emerald-200/75' : 'text-slate-500'
                                }`}
                              >
                                {track.artist}
                              </p>
                            )}
                          </div>
                        </button>

                        {/* Duration + heart + 3-dot menu */}
                        <div className="flex items-center gap-1 pr-2 flex-none">
                          <span className="text-xs text-slate-600 tabular-nums">
                            {fmtDuration(track.duration)}
                          </span>
                          {favorites && (
                            <button
                              onClick={() => favorites.toggle(track)}
                              className={`p-1.5 rounded-md transition-colors ${
                                favorites.starredIds.has(track.id)
                                  ? 'text-pink-400'
                                  : 'text-slate-600 hover:text-pink-400 opacity-0 group-hover:opacity-100'
                              }`}
                              title={
                                favorites.starredIds.has(track.id)
                                  ? 'Remove from favorites'
                                  : 'Add to favorites'
                              }
                            >
                              <Heart
                                size={13}
                                className={favorites.starredIds.has(track.id) ? 'fill-current' : ''}
                              />
                            </button>
                          )}
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
                            onToggleFavorite={favorites?.toggle}
                            isFavorited={favorites?.starredIds.has(track.id)}
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
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-none overflow-hidden border border-slate-700/50">
                              {getArtSrc(artist, 64) ? (
                                <img
                                  src={getArtSrc(artist, 64)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Mic2 size={13} className="text-slate-600 flex-none" />
                              )}
                            </div>
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
                            onClick={() => goToAlbum(album, { origin: 'search' })}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 text-left transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-md bg-slate-800 flex-none overflow-hidden border border-slate-700/50">
                              {getArtSrc(album, 64) ? (
                                <img
                                  src={getArtSrc(album, 64)}
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
                              data-spacebar-play-toggle
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

                            {/* Duration + heart + 3-dot menu */}
                            <div className="flex items-center gap-1 pr-2 flex-none">
                              <span className="text-xs text-slate-600 tabular-nums">
                                {fmtDuration(song.duration)}
                              </span>
                              {favorites && (
                                <button
                                  onClick={() => favorites.toggle(song)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    favorites.starredIds.has(song.id)
                                      ? 'text-pink-400'
                                      : 'text-slate-600 hover:text-pink-400 opacity-0 group-hover:opacity-100'
                                  }`}
                                  title={
                                    favorites.starredIds.has(song.id)
                                      ? 'Remove from favorites'
                                      : 'Add to favorites'
                                  }
                                >
                                  <Heart
                                    size={13}
                                    className={
                                      favorites.starredIds.has(song.id) ? 'fill-current' : ''
                                    }
                                  />
                                </button>
                              )}
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
                                onToggleFavorite={favorites?.toggle}
                                isFavorited={favorites?.starredIds.has(song.id)}
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

        {/* ── Favorites section ───────────────────────────── */}
        {section === 'favorites' && (
          <>
            {favorites?.loading && (
              <div className="flex justify-center items-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
              </div>
            )}

            {!favorites?.loading && favorites?.error && (
              <div className="m-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={15} className="flex-none mt-0.5" />
                <span>{favorites.error}</span>
              </div>
            )}

            {!favorites?.loading && !favorites?.error && (
              <>
                <div className="px-4 pt-3 pb-2 border-b border-slate-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-slate-200 truncate">Liked Songs</h2>
                    <div className="p-1.5 flex-none invisible" aria-hidden="true">
                      <MoreHorizontal size={13} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {favorites?.songs.length ?? 0}{' '}
                    {(favorites?.songs.length ?? 0) === 1 ? 'track' : 'tracks'}
                  </p>
                </div>

                {favorites?.songs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-700">
                    <Heart size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="text-sm">No favorites yet</p>
                      <p className="text-xs mt-1">Heart songs via the ··· menu</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="grid items-center gap-3 px-4 py-1 border-b border-slate-800/50 select-none"
                      style={{ gridTemplateColumns: favoritesListGridTemplate }}
                    >
                      <span className="text-center text-[10px] text-slate-600">#</span>
                      <div />
                      <span className="text-left text-[10px] text-slate-600">Title</span>
                      <span className="text-left text-[10px] text-slate-600">Album</span>
                      <span className="justify-self-end text-[10px] text-slate-600">Time</span>
                      <div />
                    </div>
                    <ul className="py-1">
                      {favorites.songs.map((song, idx) => {
                        const isActive = player.song?.id === song.id
                        return (
                          <li
                            key={song.id}
                            className={`group relative grid items-center gap-3 px-4 transition-colors ${isActive ? 'bg-emerald-900/20 hover:bg-emerald-900/25' : 'hover:bg-slate-800/50'}`}
                            style={{ gridTemplateColumns: favoritesListGridTemplate }}
                          >
                            <button
                              onClick={() => onPlay(song, favorites.songs)}
                              data-spacebar-play-toggle
                              className="col-[1/4] flex items-center gap-3 py-2.5 text-left min-w-0"
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
                              <div className="w-8 h-8 rounded bg-slate-800 flex-none overflow-hidden border border-slate-700/50">
                                {getSongArtSrc(song, 64) ? (
                                  <img
                                    src={getSongArtSrc(song, 64)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Mic2 size={12} className="text-slate-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                                >
                                  {song.title}
                                </p>
                                <p className="text-xs text-slate-600 truncate">{song.artist}</p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => openAlbumFromTrack(song)}
                              disabled={!song.albumId}
                              className={`min-w-0 text-xs text-left truncate transition-colors ${
                                song.albumId
                                  ? 'text-slate-500 hover:text-emerald-400'
                                  : 'text-slate-700 cursor-default'
                              }`}
                              title={song.album || ''}
                            >
                              {song.album || 'Unknown album'}
                            </button>

                            <span className="justify-self-end text-xs text-slate-600 tabular-nums">
                              {fmtDuration(song.duration)}
                            </span>
                            <div className="justify-self-end flex items-center gap-1">
                              <button
                                onClick={() => favorites?.toggle(song)}
                                className="p-1.5 rounded-md text-pink-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove from favorites"
                              >
                                <Heart size={13} className="fill-current" />
                              </button>
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
                                onToggleFavorite={favorites?.toggle}
                                isFavorited={true}
                                onClose={() => setOpenMenuId(null)}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </>
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
                <li className="group flex items-center transition-colors hover:bg-slate-800/50">
                  <button
                    onClick={() => onNavigate('favorites')}
                    className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left min-w-0"
                  >
                    <Heart size={13} className="text-pink-400 flex-none" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">Liked Songs</p>
                      <p className="text-xs text-slate-600">
                        {favorites?.songs.length ?? 0}{' '}
                        {(favorites?.songs.length ?? 0) === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                    <ChevronRight
                      size={13}
                      className="text-slate-700 group-hover:text-slate-500 transition-colors flex-none"
                    />
                  </button>
                </li>
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
                        <div className="sv-menu-panel absolute right-2 top-full mt-1 z-50 min-w-[140px] rounded-lg py-1">
                          <button
                            onClick={() => {
                              setRenamingPlaylist(pl)
                              setRenameValue(pl.name)
                              setPlaylistMenuId(null)
                            }}
                            className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                          >
                            <Pencil size={13} className="sv-menu-icon flex-none" />
                            Rename
                          </button>
                          <button
                            onClick={async () => {
                              setPlaylistMenuId(null)
                              await playlists.remove(pl.id, playlists.currentPlaylist)
                            }}
                            className="sv-menu-item sv-menu-danger w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
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
                          <div className="sv-menu-panel absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg py-1">
                            <button
                              onClick={() => {
                                setRenamingPlaylist(playlists.currentPlaylist)
                                setRenameValue(playlists.currentPlaylist?.name || '')
                                setPlaylistDetailMenuOpen(false)
                              }}
                              className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                            >
                              <Pencil size={13} className="sv-menu-icon flex-none" />
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
                              className="sv-menu-item sv-menu-danger w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
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
                  <>
                    <div
                      className="grid items-center gap-3 px-4 py-1 border-b border-slate-800/50 select-none"
                      style={{ gridTemplateColumns: playlistListGridTemplate }}
                    >
                      <span className="text-center text-[10px] text-slate-600">#</span>
                      <div />
                      <span className="text-left text-[10px] text-slate-600">Title</span>
                      <span className="text-left text-[10px] text-slate-600">Album</span>
                      <span className="justify-self-end text-[10px] text-slate-600">Time</span>
                      <div />
                    </div>
                    <ul className="py-1">
                      {playlists.tracks.map((track, idx) => {
                        const isActive = player.song?.id === track.id
                        return (
                          <li
                            key={`${track.id}-${idx}`}
                            className={`group relative grid items-center gap-3 px-4 transition-colors ${isActive ? 'bg-emerald-900/20 hover:bg-emerald-900/25' : 'hover:bg-slate-800/50'}`}
                            style={{ gridTemplateColumns: playlistListGridTemplate }}
                          >
                            <button
                              onClick={() => onPlay(track, playlists.tracks)}
                              data-spacebar-play-toggle
                              className="col-[1/4] flex items-center gap-3 py-2.5 text-left min-w-0"
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
                              <div className="w-8 h-8 rounded bg-slate-800 flex-none overflow-hidden border border-slate-700/50">
                                {getSongArtSrc(track, 64) ? (
                                  <img
                                    src={getSongArtSrc(track, 64)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Mic2 size={12} className="text-slate-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}
                                >
                                  {track.title}
                                </p>
                                <p className="text-xs text-slate-600 truncate">{track.artist}</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAlbumFromTrack(track)}
                              disabled={!track.albumId}
                              className={`min-w-0 text-xs text-left truncate transition-colors ${
                                track.albumId
                                  ? 'text-slate-500 hover:text-emerald-400'
                                  : 'text-slate-700 cursor-default'
                              }`}
                              title={track.album || ''}
                            >
                              {track.album || 'Unknown album'}
                            </button>
                            <span className="justify-self-end text-xs text-slate-600 tabular-nums">
                              {fmtDuration(track.duration)}
                            </span>
                            <div className="justify-self-end flex items-center gap-1">
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
                                <div className="sv-menu-panel absolute right-2 top-full mt-1 z-50 min-w-[180px] rounded-lg py-1">
                                  <button
                                    onClick={async () => {
                                      await playlists.removeTrack(
                                        playlists.currentPlaylist?.id,
                                        idx,
                                        playlists.currentPlaylist
                                      )
                                      setOpenPlaylistTrackMenuId(null)
                                    }}
                                    className="sv-menu-item sv-menu-danger w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
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
                  </>
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
            className="sv-modal-overlay fixed inset-0 z-40"
            onClick={() => setRenamingPlaylist(null)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[22vh] px-4">
            <div className="sv-modal-panel w-full max-w-sm rounded-xl p-4">
              <p className="text-sm font-medium text-slate-200 mb-3">Rename playlist</p>
              <form onSubmit={handleRenamePlaylist} className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="sv-modal-input rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setRenamingPlaylist(null)}
                    className="sv-btn-secondary px-3 py-1.5 text-xs rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sv-btn-primary px-3 py-1.5 text-xs rounded-md transition-colors"
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
            className="sv-modal-overlay fixed inset-0 z-40"
            onClick={() => setAddToPlaylistSong(null)}
          />
          <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[22vh] px-4"
            onClick={() => setAddToPlaylistSong(null)}
          >
            <div
              className="sv-modal-panel w-full max-w-sm rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-700/70">
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
                        className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                      >
                        <ListMusic size={13} className="sv-menu-icon flex-none" />
                        {pl.name}
                      </button>
                    </li>
                  ))}
                  {playlists.playlists.length === 0 && (
                    <li className="px-4 py-3 text-xs text-slate-600">No playlists yet</li>
                  )}
                </ul>
              )}
              <div className="border-t border-slate-700/70">
                {addToPlaylistCreating ? (
                  <form onSubmit={handleAddToPlaylistNew} className="flex items-center gap-2 p-2">
                    <input
                      autoFocus
                      value={addToPlaylistNewName}
                      onChange={(e) => setAddToPlaylistNewName(e.target.value)}
                      placeholder="Playlist name…"
                      className="sv-search-input flex-1 rounded px-2 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="sv-btn-primary text-xs px-2 py-1 rounded flex-none transition-colors"
                    >
                      Create
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddToPlaylistCreating(true)}
                    className="sv-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                  >
                    <Plus size={13} className="flex-none" />
                    New playlist
                  </button>
                )}
              </div>
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
