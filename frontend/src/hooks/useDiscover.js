import { useState, useCallback } from 'react'
import { getDiscoverBootstrap, getDiscoverTag } from '../api'

const DEFAULT_DISCOVER_TAG = 'rock'

export function useDiscover() {
  const [enabled, setEnabled] = useState(true)
  const [topTags, setTopTags] = useState([])
  const [currentTag, setCurrentTag] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadTag = useCallback(async (tagName) => {
    const normalizedTag = tagName.trim()
    if (!normalizedTag) return

    setLoading(true)
    setError(null)
    try {
      const data = await getDiscoverTag(normalizedTag)
      setEnabled(Boolean(data?.enabled))
      setCurrentTag(data)
      setQuery(data?.tag?.name ?? normalizedTag)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const init = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDiscoverBootstrap()
      const enabledFlag = Boolean(data?.enabled)
      const nextTopTags = data?.topTags || []
      const initialTag = currentTag?.tag?.name ?? nextTopTags[0]?.name ?? DEFAULT_DISCOVER_TAG

      setEnabled(enabledFlag)
      setTopTags(nextTopTags)

      if (!enabledFlag) {
        setCurrentTag({
          enabled: false,
          tag: { name: '', summary: null, reach: null, total: null },
          similarTags: [],
          topArtists: [],
          topAlbums: [],
          topTracks: [],
        })
        return
      }

      const tagData = await getDiscoverTag(initialTag)
      setCurrentTag(tagData)
      setQuery(tagData?.tag?.name ?? initialTag)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentTag?.tag?.name])

  const searchTag = useCallback(async () => {
    await loadTag(query)
  }, [loadTag, query])

  return {
    enabled,
    topTags,
    currentTag,
    query,
    loading,
    error,
    init,
    setQuery,
    loadTag,
    searchTag,
  }
}
