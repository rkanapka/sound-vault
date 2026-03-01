import { useState, useCallback } from 'react'
import { getArtists, getArtist, getAlbum, searchLibrary, triggerScan } from '../api'

export function useLibrary() {
  const [view, setView] = useState('artists') // 'artists' | 'artist' | 'album' | 'search'
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
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const goToAlbum = useCallback(
    async (album) => {
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
          { label: currentArtist?.name || album.artist || 'Artist', action: 'artist' },
        ])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [currentArtist]
  )

  const goBackToArtist = useCallback(() => {
    setView('artist')
    setBreadcrumbs([{ label: 'Artists', action: 'artists' }])
  }, [])

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

  const scan = useCallback(async () => {
    setScanning(true)
    try {
      await triggerScan()
    } catch {
      // scan errors are non-fatal
    } finally {
      setTimeout(() => setScanning(false), 2000)
    }
  }, [])

  return {
    view,
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
    loadArtists,
    goToArtist,
    goToAlbum,
    goBackToArtist,
    searchLib,
    scan,
  }
}
