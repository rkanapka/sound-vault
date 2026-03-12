import { useState, useCallback } from 'react'
import { getStarred, starSong, unstarSong } from '../api'

export function useFavorites() {
  const [songs, setSongs] = useState([])
  const [starredIds, setStarredIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStarred()
      const resp = data['subsonic-response']
      const starred = resp.starred2?.song || []
      setSongs(starred)
      setStarredIds(new Set(starred.map((s) => s.id)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback(
    async (song) => {
      const isStarred = starredIds.has(song.id)

      // Optimistic update
      setStarredIds((prev) => {
        const next = new Set(prev)
        if (isStarred) next.delete(song.id)
        else next.add(song.id)
        return next
      })
      setSongs((prev) => (isStarred ? prev.filter((s) => s.id !== song.id) : [...prev, song]))

      try {
        if (isStarred) await unstarSong(song.id)
        else await starSong(song.id)
      } catch {
        // Revert on error
        setStarredIds((prev) => {
          const next = new Set(prev)
          if (isStarred) next.add(song.id)
          else next.delete(song.id)
          return next
        })
        setSongs((prev) => (isStarred ? [...prev, song] : prev.filter((s) => s.id !== song.id)))
      }
    },
    [starredIds]
  )

  const init = useCallback(() => load(), [load])

  return { songs, starredIds, loading, error, load, toggle, init }
}
