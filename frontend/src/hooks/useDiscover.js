import { useCallback, useState } from 'react'
import {
  getDiscoverBootstrap,
  getDiscoverCharts,
  getDiscoverTag,
  getDiscoverTagCharts,
} from '../api'

const DEFAULT_CHART_KIND = 'artists'
const DEFAULT_DISCOVER_LIMITS = {
  artists: 20,
  albums: 20,
  tracks: 20,
}

const EMPTY_TAG_CHART_LOADING = { artists: false, albums: false, tracks: false }
const EMPTY_TAG_CHART_ERRORS = { artists: null, albums: null, tracks: null }

function emptyTagState(enabled, name = '') {
  return {
    enabled,
    tag: { name, summary: null, reach: null, total: null },
    similarTags: [],
    topArtists: [],
    topAlbums: [],
    topTracks: [],
  }
}

function emptyChartState(enabled, kind, page = 1) {
  return { enabled, kind, page, totalPages: 0, items: [] }
}

function emptyTagChartState(enabled, tag, kind, page = 1) {
  return { enabled, tag, kind, page, totalPages: 0, items: [] }
}

function normalizeTagKey(tagName) {
  return String(tagName || '')
    .trim()
    .toLocaleLowerCase()
}

function discoverLimitForKind(kind) {
  return DEFAULT_DISCOVER_LIMITS[kind] ?? DEFAULT_DISCOVER_LIMITS.tracks
}

export function useDiscover() {
  const [enabled, setEnabled] = useState(true)
  const [mode, setMode] = useState('global')
  const [chartKind, setChartKind] = useState(DEFAULT_CHART_KIND)
  const [topTags, setTopTags] = useState([])
  const [trendingArtists, setTrendingArtists] = useState([])
  const [trendingTracks, setTrendingTracks] = useState([])
  const [charts, setCharts] = useState({ artists: null, tracks: null })
  const [currentTag, setCurrentTag] = useState(null)
  const [expandedTagKind, setExpandedTagKind] = useState(null)
  const [tagCharts, setTagCharts] = useState({})
  const [tagChartSelections, setTagChartSelections] = useState({})
  const [query, setQuery] = useState('')
  const [soulseekSeedQuery, setSoulseekSeedQuery] = useState('')
  const [initializing, setInitializing] = useState(false)
  const [tagLoading, setTagLoading] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [tagChartLoading, setTagChartLoading] = useState(EMPTY_TAG_CHART_LOADING)
  const [tagChartErrors, setTagChartErrors] = useState(EMPTY_TAG_CHART_ERRORS)
  const [error, setError] = useState(null)

  const resolveTagName = useCallback(
    (tagName) => {
      const explicitTag = String(tagName || '').trim()
      if (explicitTag) return explicitTag

      const currentTagName = String(currentTag?.tag?.name || '').trim()
      if (currentTagName) return currentTagName

      const currentQuery = String(query || '').trim()
      if (currentQuery) return currentQuery

      const topTagName = String(topTags[0]?.name || '').trim()
      return topTagName || 'rock'
    },
    [currentTag, query, topTags]
  )

  const loadChart = useCallback(async (kind = DEFAULT_CHART_KIND, page = 1) => {
    setChartLoading(true)
    setError(null)
    try {
      const data = await getDiscoverCharts(kind, page, discoverLimitForKind(kind))
      const nextEnabled = Boolean(data?.enabled)
      setEnabled(nextEnabled)
      setChartKind(kind)
      setCharts((prev) => ({
        ...prev,
        [kind]: data || emptyChartState(nextEnabled, kind, page),
      }))
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setChartLoading(false)
    }
  }, [])

  const loadTag = useCallback(
    async (tagName, { switchMode = true, force = false } = {}) => {
      const normalizedTag = String(tagName || '').trim()
      if (!normalizedTag) return null

      if (
        !force &&
        currentTag?.tag?.name?.toLocaleLowerCase() === normalizedTag.toLocaleLowerCase()
      ) {
        if (switchMode) setMode('tags')
        setQuery(currentTag.tag.name)
        return currentTag
      }

      if (normalizeTagKey(currentTag?.tag?.name) !== normalizeTagKey(normalizedTag)) {
        setExpandedTagKind(null)
        setTagChartLoading(EMPTY_TAG_CHART_LOADING)
        setTagChartErrors(EMPTY_TAG_CHART_ERRORS)
      }

      setTagLoading(true)
      setError(null)
      try {
        const data = await getDiscoverTag(normalizedTag)
        const nextEnabled = Boolean(data?.enabled)
        setEnabled(nextEnabled)
        setCurrentTag(data || emptyTagState(nextEnabled, normalizedTag))
        setQuery(data?.tag?.name ?? normalizedTag)
        if (switchMode) setMode('tags')
        return data
      } catch (e) {
        setError(e.message)
        throw e
      } finally {
        setTagLoading(false)
      }
    },
    [currentTag]
  )

  const init = useCallback(async () => {
    setInitializing(true)
    setError(null)
    try {
      const data = await getDiscoverBootstrap()
      const nextEnabled = Boolean(data?.enabled)

      setEnabled(nextEnabled)
      setTopTags(data?.topTags || [])
      setTrendingArtists(data?.trendingArtists || [])
      setTrendingTracks(data?.trendingTracks || [])

      if (!nextEnabled) {
        setCharts({
          artists: emptyChartState(false, 'artists', 1),
          tracks: emptyChartState(false, 'tracks', 1),
        })
        setCurrentTag(emptyTagState(false))
        setExpandedTagKind(null)
        return
      }

      await loadChart(DEFAULT_CHART_KIND, 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setInitializing(false)
    }
  }, [loadChart])

  const showGlobal = useCallback(
    async (kind = chartKind, { page = 1, ensurePage = false } = {}) => {
      setError(null)
      setMode('global')
      setChartKind(kind)

      if (!charts[kind] || (ensurePage && charts[kind]?.page !== page)) {
        await loadChart(kind, page)
      }
    },
    [chartKind, charts, loadChart]
  )

  const showTag = useCallback(
    async (tagName) => {
      setError(null)
      setMode('tags')
      await loadTag(resolveTagName(tagName), { switchMode: false })
    },
    [loadTag, resolveTagName]
  )

  const loadChartPage = useCallback(
    async (page, kind = chartKind) => {
      setMode('global')
      await loadChart(kind, page)
    },
    [chartKind, loadChart]
  )

  const loadTagChart = useCallback(
    async (tagName, kind, page = 1, { force = false, expand = true } = {}) => {
      const resolvedTagName = resolveTagName(tagName)
      if (!resolvedTagName) return null

      const tagKey = normalizeTagKey(resolvedTagName)
      const cached = !force ? tagCharts[tagKey]?.[kind]?.[page] : null

      setTagChartErrors((prev) => ({ ...prev, [kind]: null }))

      if (cached) {
        setTagChartSelections((prev) => ({
          ...prev,
          [tagKey]: { ...(prev[tagKey] || {}), [kind]: page },
        }))
        if (expand) setExpandedTagKind(kind)
        return cached
      }

      setTagChartLoading((prev) => ({ ...prev, [kind]: true }))
      try {
        const data = await getDiscoverTagCharts(
          resolvedTagName,
          kind,
          page,
          discoverLimitForKind(kind)
        )
        const nextEnabled = Boolean(data?.enabled)
        const nextChart = data || emptyTagChartState(nextEnabled, resolvedTagName, kind, page)

        setEnabled(nextEnabled)
        setTagCharts((prev) => ({
          ...prev,
          [tagKey]: {
            ...(prev[tagKey] || {}),
            [kind]: {
              ...((prev[tagKey] || {})[kind] || {}),
              [page]: nextChart,
            },
          },
        }))
        setTagChartSelections((prev) => ({
          ...prev,
          [tagKey]: { ...(prev[tagKey] || {}), [kind]: page },
        }))
        if (expand) setExpandedTagKind(kind)
        return nextChart
      } catch (e) {
        setTagChartErrors((prev) => ({ ...prev, [kind]: e.message }))
        throw e
      } finally {
        setTagChartLoading((prev) => ({ ...prev, [kind]: false }))
      }
    },
    [resolveTagName, tagCharts]
  )

  const showTagChart = useCallback(
    async (kind) => {
      const resolvedTagName = resolveTagName(currentTag?.tag?.name)
      if (!resolvedTagName) return

      const tagKey = normalizeTagKey(resolvedTagName)
      const page = tagChartSelections[tagKey]?.[kind] ?? 1
      await loadTagChart(resolvedTagName, kind, page, { expand: true })
    },
    [currentTag, loadTagChart, resolveTagName, tagChartSelections]
  )

  const loadTagChartPage = useCallback(
    async (kind, page) => {
      const resolvedTagName = resolveTagName(currentTag?.tag?.name)
      if (!resolvedTagName) return

      await loadTagChart(resolvedTagName, kind, page, { expand: true })
    },
    [currentTag, loadTagChart, resolveTagName]
  )

  const searchTag = useCallback(async () => {
    await loadTag(query)
  }, [loadTag, query])

  const currentTagKey = normalizeTagKey(currentTag?.tag?.name)
  const currentTagSelections = tagChartSelections[currentTagKey] || {}
  const currentTagChartPages = {
    artists: currentTagSelections.artists ?? 1,
    albums: currentTagSelections.albums ?? 1,
    tracks: currentTagSelections.tracks ?? 1,
  }
  const currentTagCharts = {
    artists: tagCharts[currentTagKey]?.artists?.[currentTagChartPages.artists] ?? null,
    albums: tagCharts[currentTagKey]?.albums?.[currentTagChartPages.albums] ?? null,
    tracks: tagCharts[currentTagKey]?.tracks?.[currentTagChartPages.tracks] ?? null,
  }

  return {
    enabled,
    mode,
    chartKind,
    topTags,
    trendingArtists,
    trendingTracks,
    currentChart: charts[chartKind],
    currentTag,
    currentTagCharts,
    currentTagChartPages,
    expandedTagKind,
    query,
    soulseekSeedQuery,
    loading: initializing || tagLoading || chartLoading,
    initializing,
    tagLoading,
    chartLoading,
    tagChartLoading,
    tagChartErrors,
    error,
    init,
    setQuery,
    setSoulseekSeedQuery,
    loadTag,
    showTag,
    showGlobal,
    loadChartPage,
    showTagChart,
    loadTagChartPage,
    searchTag,
  }
}
