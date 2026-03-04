import { useState, useCallback } from 'react'
import { getPlaylists, getPlaylist, createPlaylist, updatePlaylist, deletePlaylist } from '../api'

export function usePlaylists() {
  const [view, setView] = useState('list') // 'list' | 'detail'
  const [playlists, setPlaylists] = useState([])
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadPlaylists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPlaylists()
      const resp = data['subsonic-response']
      const all = resp.playlists?.playlist || []
      setPlaylists(all.slice().sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const openPlaylist = useCallback(async (playlist) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPlaylist(playlist.id)
      const resp = data['subsonic-response']
      const pl = resp.playlist
      setCurrentPlaylist(pl)
      setTracks(pl.entry || [])
      setView('detail')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const backToList = useCallback(() => {
    setView('list')
    setCurrentPlaylist(null)
    setTracks([])
  }, [])

  const create = useCallback(
    async (name, songIds = []) => {
      const data = await createPlaylist(name, songIds)
      const pl = data?.['subsonic-response']?.playlist
      await loadPlaylists()
      return pl
    },
    [loadPlaylists]
  )

  const rename = useCallback(async (id, name) => {
    await updatePlaylist(id, { name })
    setCurrentPlaylist((p) => (p?.id === id ? { ...p, name } : p))
    setPlaylists((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, name } : p))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  }, [])

  const remove = useCallback(async (id, currentPlaylistRef) => {
    await deletePlaylist(id)
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
    if (currentPlaylistRef?.id === id) {
      setCurrentPlaylist(null)
      setTracks([])
      setView('list')
    }
  }, [])

  const addTrack = useCallback(async (playlistId, songId) => {
    await updatePlaylist(playlistId, { song_ids_to_add: [songId] })
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, songCount: (p.songCount ?? 0) + 1 } : p))
    )
  }, [])

  const removeTrack = useCallback(async (playlistId, songIndex, currentPlaylistRef) => {
    await updatePlaylist(playlistId, { song_indexes_to_remove: [songIndex] })
    if (currentPlaylistRef?.id === playlistId) {
      const data = await getPlaylist(playlistId)
      const pl = data['subsonic-response']?.playlist
      if (pl) {
        setCurrentPlaylist(pl)
        setTracks(pl.entry || [])
      }
    }
  }, [])

  const init = useCallback(async () => {
    await loadPlaylists()
  }, [loadPlaylists])

  return {
    view,
    playlists,
    currentPlaylist,
    tracks,
    loading,
    error,
    init,
    loadPlaylists,
    openPlaylist,
    backToList,
    create,
    rename,
    remove,
    addTrack,
    removeTrack,
  }
}
