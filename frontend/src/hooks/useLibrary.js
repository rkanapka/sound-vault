import { useState, useCallback } from 'react'
import {
  getArtists,
  getArtist,
  getAlbum,
  getAlbumList,
  searchLibrary,
  triggerScan,
  getScanStatus,
} from '../api'

export function useLibrary() {
  const [view, setView] = useState('artists') // 'home' | 'artists' | 'artist' | 'album' | 'search'
  const [newestAlbums, setNewestAlbums] = useState([])
  const [recentAlbums, setRecentAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [currentArtist, setCurrentArtist] = useState(null)
  const [albums, setAlbums] = useState([])
  const [currentAlbum, setCurrentAlbum] = useState(null)
  const [tracks, setTracks] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

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
      localStorage.removeItem('sv-lib-artist-id')
      localStorage.removeItem('sv-lib-album-id')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadArtists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getArtists()
      const resp = data['subsonic-response']
      const indexes = resp.artists?.index || []
      const all = indexes.flatMap((idx) => idx.artist || [])
      setArtists(all.sort((a, b) => a.name.localeCompare(b.name)))
      setView('artists')
      setBreadcrumbs([])
      localStorage.removeItem('sv-lib-artist-id')
      localStorage.removeItem('sv-lib-album-id')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const goToArtist = useCallback(async (artist) => {
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
      localStorage.setItem('sv-lib-artist-id', artist.id)
      localStorage.removeItem('sv-lib-album-id')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const goToAlbum = useCallback(async (album) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAlbum(album.id)
      const resp = data['subsonic-response']
      const albumData = resp.album
      setCurrentAlbum(albumData)
      setTracks(albumData.song || [])
      setView('album')
      setBreadcrumbs([
        { label: 'Artists', action: 'artists' },
        { label: albumData.artist || 'Artist', action: 'artist' },
      ])
      localStorage.setItem('sv-lib-album-id', album.id)
      if (albumData.artistId) localStorage.setItem('sv-lib-artist-id', albumData.artistId)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const goBackToArtist = useCallback(async () => {
    // If artist albums aren't loaded (e.g. after a page refresh that restored album view),
    // re-fetch the artist so the back-navigation works correctly.
    if (albums.length === 0 && currentAlbum?.artistId) {
      await goToArtist({ id: currentAlbum.artistId })
    } else {
      setView('artist')
      setBreadcrumbs([{ label: 'Artists', action: 'artists' }])
    }
  }, [albums, currentAlbum, goToArtist])

  const searchLib = useCallback(
    async (q) => {
      if (!q.trim()) {
        loadArtists()
        return
      }
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
        setBreadcrumbs([{ label: 'Artists', action: 'artists' }])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [loadArtists]
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

  // Restore previous navigation on page load, or fall back to home
  const init = useCallback(async () => {
    const albumId = localStorage.getItem('sv-lib-album-id')
    const artistId = localStorage.getItem('sv-lib-artist-id')
    if (albumId) {
      await goToAlbum({ id: albumId })
    } else if (artistId) {
      await goToArtist({ id: artistId })
    } else {
      await loadHome()
    }
  }, [goToAlbum, goToArtist, loadHome])

  return {
    view,
    newestAlbums,
    recentAlbums,
    artists,
    currentArtist,
    albums,
    currentAlbum,
    tracks,
    searchResults,
    breadcrumbs,
    loading,
    error,
    scanning,
    init,
    loadHome,
    loadArtists,
    goToArtist,
    goToAlbum,
    goBackToArtist,
    searchLib,
    scan,
    pollScanDone,
  }
}
