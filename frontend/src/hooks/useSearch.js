import { useState, useRef, useCallback } from 'react'
import { searchSoulseek, pollSearch, stopSearch as apiStopSearch } from '../api'

const AUDIO_EXTS = new Set(['flac', 'mp3', 'ogg', 'aac', 'opus', 'wav', 'm4a'])

function isAudio(filename) {
  return AUDIO_EXTS.has(filename.split('.').pop().toLowerCase())
}

function groupByUser(responses) {
  const groups = {}
  for (const resp of responses) {
    const files = (resp.files || []).filter((f) => isAudio(f.filename))
    if (files.length === 0) continue
    if (!groups[resp.username]) groups[resp.username] = []
    groups[resp.username].push(...files)
  }
  return groups
}

export function useSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({})
  const [searching, setSearching] = useState(false)

  const pollTimer = useRef(null)
  const searchIdRef = useRef(null)

  const stopSearch = useCallback(async () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    if (searchIdRef.current) {
      await apiStopSearch(searchIdRef.current).catch(() => {})
      searchIdRef.current = null
    }
    setSearching(false)
  }, [])

  const startSearch = useCallback(
    async (q) => {
      if (!q.trim()) return
      await stopSearch()
      setResults({})
      setSearching(true)
      try {
        const data = await searchSoulseek(q)
        searchIdRef.current = data.id
        pollTimer.current = setInterval(async () => {
          try {
            const data = await pollSearch(searchIdRef.current)
            setResults(groupByUser(data.responses || []))
            if (data.isComplete) {
              clearInterval(pollTimer.current)
              pollTimer.current = null
              setSearching(false)
            }
          } catch {
            // polling failures are non-fatal
          }
        }, 2000)
      } catch (e) {
        console.error('Search failed:', e)
        setSearching(false)
      }
    },
    [stopSearch]
  )

  return { query, setQuery, results, searching, startSearch, stopSearch }
}
