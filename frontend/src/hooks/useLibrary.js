import { useState, useCallback, useRef } from 'react'
import {
  getArtists,
  getArtist,
  getAlbum,
  getAlbumList,
  searchLibrary,
  triggerScan,
  getScanStatus,
} from '../api'

const LIBRARY_TAB_KEY = 'sv-lib-tab'
const LIBRARY_ALBUM_ORIGIN_KEY = 'sv-lib-album-origin'
const LIBRARY_ARTIST_ID_KEY = 'sv-lib-artist-id'
const LIBRARY_ALBUM_ID_KEY = 'sv-lib-album-id'
const ALBUM_PAGE_SIZE = 100

function getStoredBrowseTab() {
  return localStorage.getItem(LIBRARY_TAB_KEY) === 'albums' ? 'albums' : 'artists'
}

function persistBrowseTab(tab) {
  try {
    localStorage.setItem(LIBRARY_TAB_KEY, tab)
  } catch {}
}

function readStoredAlbumOrigin() {
  try {
    const raw = localStorage.getItem(LIBRARY_ALBUM_ORIGIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !['artist', 'albums', 'search'].includes(parsed.type)) return null
    return parsed
  } catch {
    return null
  }
}

function persistAlbumOrigin(origin) {
  try {
    localStorage.setItem(LIBRARY_ALBUM_ORIGIN_KEY, JSON.stringify(origin))
  } catch {}
}

function clearLibraryDetailStorage() {
  try {
    localStorage.removeItem(LIBRARY_ARTIST_ID_KEY)
    localStorage.removeItem(LIBRARY_ALBUM_ID_KEY)
    localStorage.removeItem(LIBRARY_ALBUM_ORIGIN_KEY)
  } catch {}
}

function getSearchBreadcrumbs(tab) {
  return [{ label: tab === 'albums' ? 'Albums' : 'Artists', action: tab }]
}

function getAlbumBreadcrumbs(album, origin) {
  if (origin.type === 'albums') return [{ label: 'Albums', action: 'albums' }]
  if (origin.type === 'search') return [{ label: 'Search', action: 'search' }]
  return [
    { label: 'Artists', action: 'artists' },
    { label: origin.artistName || album.artist || 'Artist', action: 'artist' },
  ]
}

export function useLibrary() {
  const [view, setView] = useState('artists') // 'home' | 'artists' | 'albums' | 'artist' | 'album' | 'search'
  const [browseTab, setBrowseTabState] = useState(getStoredBrowseTab)
  const [newestAlbums, setNewestAlbums] = useState([])
  const [recentAlbums, setRecentAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [currentArtist, setCurrentArtist] = useState(null)
  const [albums, setAlbums] = useState([])
  const [allAlbums, setAllAlbums] = useState([])
  const [allAlbumsHasMore, setAllAlbumsHasMore] = useState(true)
  const [loadingMoreAlbums, setLoadingMoreAlbums] = useState(false)
  const [currentAlbum, setCurrentAlbum] = useState(null)
  const [tracks, setTracks] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

  const browseTabRef = useRef(browseTab)
  const allAlbumsRef = useRef([])
  const allAlbumsOffsetRef = useRef(0)
  const allAlbumsHasMoreRef = useRef(true)
  const loadingMoreAlbumsRef = useRef(false)
  const albumOriginRef = useRef(readStoredAlbumOrigin())

  const setBrowseTab = useCallback((tab) => {
    browseTabRef.current = tab
    setBrowseTabState(tab)
    persistBrowseTab(tab)
  }, [])

  const fetchAlbumPage = useCallback(async (offset) => {
    const data = await getAlbumList('alphabeticalByName', ALBUM_PAGE_SIZE, offset)
    const resp = data['subsonic-response']
    return resp.albumList2?.album || []
  }, [])

  const loadHome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [newestData, recentData] = await Promise.all([
        getAlbumList('newest', 20),
        getAlbumList('recent', 20),
      ])
      const toAlbums = (data) => {
        const resp = data['subsonic-response']
        return resp.albumList2?.album || []
      }
      setNewestAlbums(toAlbums(newestData))
      setRecentAlbums(toAlbums(recentData))
      setView('home')
      setBreadcrumbs([])
      clearLibraryDetailStorage()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadArtists = useCallback(
    async ({ force = false } = {}) => {
      setBrowseTab('artists')
      clearLibraryDetailStorage()
      setError(null)

      if (!force && artists.length > 0) {
        setView('artists')
        setBreadcrumbs([])
        return
      }

      setLoading(true)
      try {
        const data = await getArtists()
        const resp = data['subsonic-response']
        const indexes = resp.artists?.index || []
        const all = indexes.flatMap((idx) => idx.artist || [])
        setArtists(all.sort((a, b) => a.name.localeCompare(b.name)))
        setView('artists')
        setBreadcrumbs([])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [artists.length, setBrowseTab]
  )

  const loadAlbums = useCallback(
    async ({ force = false } = {}) => {
      setBrowseTab('albums')
      clearLibraryDetailStorage()
      setError(null)

      if (!force && allAlbumsRef.current.length > 0) {
        setView('albums')
        setBreadcrumbs([])
        return
      }

      setLoading(true)
      try {
        const page = await fetchAlbumPage(0)
        allAlbumsRef.current = page
        allAlbumsOffsetRef.current = page.length
        allAlbumsHasMoreRef.current = page.length === ALBUM_PAGE_SIZE
        setAllAlbums(page)
        setAllAlbumsHasMore(allAlbumsHasMoreRef.current)
        setView('albums')
        setBreadcrumbs([])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [fetchAlbumPage, setBrowseTab]
  )

  const loadMoreAlbums = useCallback(async () => {
    if (loadingMoreAlbumsRef.current || !allAlbumsHasMoreRef.current) return

    loadingMoreAlbumsRef.current = true
    setLoadingMoreAlbums(true)
    setError(null)

    try {
      const page = await fetchAlbumPage(allAlbumsOffsetRef.current)
      const nextAlbums = [...allAlbumsRef.current, ...page]
      allAlbumsRef.current = nextAlbums
      allAlbumsOffsetRef.current += page.length
      allAlbumsHasMoreRef.current = page.length === ALBUM_PAGE_SIZE
      setAllAlbums(nextAlbums)
      setAllAlbumsHasMore(allAlbumsHasMoreRef.current)
    } catch (e) {
      setError(e.message)
    } finally {
      loadingMoreAlbumsRef.current = false
      setLoadingMoreAlbums(false)
    }
  }, [fetchAlbumPage])

  const ensureAllAlbumsLoaded = useCallback(async () => {
    while (allAlbumsHasMoreRef.current) {
      const prevOffset = allAlbumsOffsetRef.current
      await loadMoreAlbums()
      if (allAlbumsOffsetRef.current === prevOffset) break
    }
  }, [loadMoreAlbums])

  const goToArtist = useCallback(
    async (artist) => {
      setBrowseTab('artists')
      setLoading(true)
      setError(null)
      try {
        const data = await getArtist(artist.id)
        const resp = data['subsonic-response']
        const artistData = resp.artist
        setCurrentArtist(artistData)
        setAlbums(artistData.album || [])
        setView('artist')
        setBreadcrumbs([{ label: 'Artists', action: 'artists' }])
        localStorage.setItem(LIBRARY_ARTIST_ID_KEY, artist.id)
        localStorage.removeItem(LIBRARY_ALBUM_ID_KEY)
        localStorage.removeItem(LIBRARY_ALBUM_ORIGIN_KEY)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [setBrowseTab]
  )

  const resolveAlbumOrigin = useCallback(
    (album, origin) => {
      if (
        origin &&
        typeof origin === 'object' &&
        ['artist', 'albums', 'search'].includes(origin.type)
      ) {
        return origin
      }

      if (origin === 'search' || view === 'search') {
        return { type: 'search' }
      }

      if (origin === 'albums' || view === 'albums') {
        return { type: 'albums' }
      }

      if (origin === 'artist' || view === 'artist') {
        return {
          type: 'artist',
          artistId: currentArtist?.id ?? album.artistId ?? null,
          artistName: currentArtist?.name ?? album.artist ?? null,
        }
      }

      if (browseTabRef.current === 'albums') {
        return { type: 'albums' }
      }

      return {
        type: 'artist',
        artistId: currentArtist?.id ?? album.artistId ?? null,
        artistName: currentArtist?.name ?? album.artist ?? null,
      }
    },
    [currentArtist, view]
  )

  const goToAlbum = useCallback(
    async (album, options = {}) => {
      const origin = resolveAlbumOrigin(album, options.origin)
      if (origin.type === 'albums') setBrowseTab('albums')
      if (origin.type === 'artist') setBrowseTab('artists')

      setLoading(true)
      setError(null)
      try {
        const data = await getAlbum(album.id)
        const resp = data['subsonic-response']
        const albumData = resp.album
        setCurrentAlbum(albumData)
        setTracks(albumData.song || [])
        setView('album')
        setBreadcrumbs(getAlbumBreadcrumbs(albumData, origin))
        albumOriginRef.current = origin
        persistAlbumOrigin(origin)
        localStorage.setItem(LIBRARY_ALBUM_ID_KEY, album.id)
        if (origin.type === 'artist' && (origin.artistId || albumData.artistId)) {
          localStorage.setItem(LIBRARY_ARTIST_ID_KEY, origin.artistId ?? albumData.artistId)
        } else {
          localStorage.removeItem(LIBRARY_ARTIST_ID_KEY)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [resolveAlbumOrigin, setBrowseTab]
  )

  const goBackToArtist = useCallback(async () => {
    if (albums.length === 0 && currentAlbum?.artistId) {
      await goToArtist({ id: currentAlbum.artistId })
    } else {
      setView('artist')
      setBreadcrumbs([{ label: 'Artists', action: 'artists' }])
    }
  }, [albums.length, currentAlbum, goToArtist])

  const openSearchResults = useCallback(async () => {
    if (!searchResults) {
      if (browseTabRef.current === 'albums') await loadAlbums()
      else await loadArtists()
      return
    }
    setView('search')
    setBreadcrumbs(getSearchBreadcrumbs(browseTabRef.current))
  }, [loadAlbums, loadArtists, searchResults])

  const exitSearch = useCallback(async () => {
    setSearchResults(null)

    if (view === 'search') {
      if (browseTabRef.current === 'albums') await loadAlbums()
      else await loadArtists()
      return
    }

    if (view === 'album' && currentAlbum && albumOriginRef.current?.type === 'search') {
      const fallbackOrigin =
        browseTabRef.current === 'albums'
          ? { type: 'albums' }
          : {
              type: 'artist',
              artistId: currentAlbum.artistId ?? null,
              artistName: currentAlbum.artist ?? null,
            }
      albumOriginRef.current = fallbackOrigin
      persistAlbumOrigin(fallbackOrigin)
      setBreadcrumbs(getAlbumBreadcrumbs(currentAlbum, fallbackOrigin))
      if (fallbackOrigin.type === 'artist' && fallbackOrigin.artistId) {
        localStorage.setItem(LIBRARY_ARTIST_ID_KEY, fallbackOrigin.artistId)
      } else {
        localStorage.removeItem(LIBRARY_ARTIST_ID_KEY)
      }
    }
  }, [currentAlbum, loadAlbums, loadArtists, view])

  const searchLib = useCallback(async (q) => {
    if (!q.trim()) return

    setLoading(true)
    setError(null)
    try {
      const data = await searchLibrary(q)
      const resp = data['subsonic-response']
      const result = resp.searchResult3 || {}
      setSearchResults({
        artists: result.artist || [],
        albums: result.album || [],
        songs: result.song || [],
      })
      setView('search')
      setBreadcrumbs(getSearchBreadcrumbs(browseTabRef.current))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const openLibrary = useCallback(
    async ({ force = false } = {}) => {
      if (browseTabRef.current === 'albums') await loadAlbums({ force })
      else await loadArtists({ force })
    },
    [loadAlbums, loadArtists]
  )

  const pollScanDone = useCallback(async () => {
    let seenScanning = false
    for (let i = 0; i < 60; i++) {
      try {
        const data = await getScanStatus()
        const resp = data['subsonic-response']
        const isScanning = !!resp.scanStatus?.scanning
        if (isScanning) seenScanning = true
        if (seenScanning && !isScanning) return
      } catch {
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }, [])

  const scan = useCallback(
    async (onDone) => {
      setScanning(true)
      try {
        await triggerScan()
        await pollScanDone()
        onDone?.()
      } catch {
        // scan errors are non-fatal
      } finally {
        setScanning(false)
      }
    },
    [pollScanDone]
  )

  const init = useCallback(async () => {
    const albumId = localStorage.getItem(LIBRARY_ALBUM_ID_KEY)
    const artistId = localStorage.getItem(LIBRARY_ARTIST_ID_KEY)
    if (albumId) {
      const storedOrigin = readStoredAlbumOrigin()
      const initialOrigin =
        storedOrigin?.type === 'search'
          ? { type: 'albums' }
          : storedOrigin || (artistId ? { type: 'artist', artistId } : { type: 'albums' })
      await goToAlbum({ id: albumId, artistId }, { origin: initialOrigin })
    } else if (artistId) {
      setBrowseTab('artists')
      await goToArtist({ id: artistId })
    } else {
      await loadHome()
    }
  }, [goToAlbum, goToArtist, loadHome, setBrowseTab])

  return {
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
    currentAlbumOrigin: albumOriginRef.current,
    tracks,
    searchResults,
    breadcrumbs,
    loading,
    error,
    scanning,
    init,
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
  }
}
