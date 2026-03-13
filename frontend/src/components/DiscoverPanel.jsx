import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Disc3,
  Globe,
  Library,
  Loader2,
  Mic2,
  Music4,
  Radio,
  Search,
  Sparkles,
} from 'lucide-react'
import { getDiscoverCardImage } from '../utils/discover'

function fmtCount(value) {
  if (value == null) return null
  return new Intl.NumberFormat().format(value)
}

function tagMetric(tag) {
  return tag?.reach ?? tag?.count ?? null
}

function cardIcon(kind) {
  if (kind === 'artist') return Mic2
  if (kind === 'album') return Disc3
  return Music4
}

function chartKindLabel(kind) {
  if (kind === 'artists') return 'Artists'
  if (kind === 'albums') return 'Albums'
  return 'Tracks'
}

function explorerAccent(kind) {
  if (kind === 'albums') return 'text-amber-200/80'
  if (kind === 'tracks') return 'text-cyan-200/80'
  return 'text-emerald-200/80'
}

function TagChip({ tag, active = false, onClick }) {
  return (
    <button
      onClick={() => onClick(tag.name)}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-200'
          : 'border-slate-700/70 bg-slate-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      <span>{tag.name}</span>
      {tagMetric(tag) != null && (
        <span className="ml-1.5 text-[10px] text-slate-500">{fmtCount(tagMetric(tag))}</span>
      )}
    </button>
  )
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-emerald-500/16 text-emerald-100'
          : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function ExplorerBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-black/25 px-3 py-1 text-[11px] font-medium text-slate-300">
      {children}
    </span>
  )
}

function ExplorerHeader({ eyebrow, accentClassName, title, description, badges = [], children }) {
  return (
    <div className="border-b border-slate-800/70 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${accentClassName}`}>
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

          {badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <ExplorerBadge key={badge}>{badge}</ExplorerBadge>
              ))}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}

function DiscoverCard({
  card,
  pendingId,
  onPrimaryAction,
  onSecondaryAction,
  onSearchSoulseek,
  compact = false,
  chartCompact = false,
  dense = false,
}) {
  const Icon = cardIcon(card.kind)
  const imageSrc = getDiscoverCardImage(
    card,
    dense ? 192 : chartCompact ? 256 : compact ? 240 : 320
  )
  const actionKey = card.inLibrary
    ? String(card.libraryId ?? `${card.kind}:${card.title}`)
    : `search:${card.kind}:${card.soulseekQuery}`
  const isPending = pendingId === actionKey

  return (
    <article
      className={`rounded-[1.4rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(19,22,23,0.88),rgba(10,12,13,0.96))] shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${
        dense || chartCompact ? 'p-2.5' : 'p-3'
      } ${compact ? 'w-56 flex-none' : 'w-full'}`}
    >
      <div className={dense ? 'flex gap-3' : ''}>
        <div
          className={`relative overflow-hidden border border-slate-700/60 bg-slate-900/80 ${
            dense ? 'w-20 flex-none rounded-[1rem]' : 'rounded-2xl'
          }`}
        >
          {imageSrc ? (
            <img src={imageSrc} alt="" className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_55%,#020617_100%)] text-slate-600">
              <Icon size={dense ? 20 : 30} strokeWidth={1.5} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 backdrop-blur-sm">
            {card.kind}
          </div>
          {card.inLibrary && (
            <div className="absolute right-2 top-2 rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur-sm">
              Library
            </div>
          )}
        </div>

        <div className={`min-w-0 ${dense ? 'flex flex-1 flex-col' : ''}`}>
          <div
            className={
              dense ? 'min-h-0' : `mt-3 ${chartCompact ? 'min-h-[3.4rem]' : 'min-h-[4rem]'}`
            }
          >
            <p
              className={`line-clamp-2 font-medium leading-snug text-slate-100 ${
                dense || chartCompact ? 'text-[13px]' : 'text-sm'
              }`}
            >
              {card.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
              {card.artistName || 'Artist'}
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                card.inLibrary
                  ? onPrimaryAction(card, actionKey)
                  : onSearchSoulseek(card, actionKey)
              }
              disabled={isPending}
              className={`flex-1 rounded-xl font-medium transition-colors ${
                dense || chartCompact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
              } ${
                card.inLibrary
                  ? 'bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/24'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              } ${isPending ? 'cursor-default opacity-70' : ''}`}
            >
              {isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Working
                </span>
              ) : card.inLibrary ? (
                card.kind === 'track' ? (
                  'Play'
                ) : (
                  'Open'
                )
              ) : (
                'Soulseek'
              )}
            </button>
            {card.inLibrary && onSecondaryAction && (
              <button
                onClick={() => onSecondaryAction(card)}
                className={`rounded-xl border border-slate-700/70 bg-slate-900/50 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white ${
                  dense || chartCompact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
                }`}
                title={card.kind === 'track' ? 'Open album' : 'Open in library'}
              >
                {card.kind === 'track' ? <Disc3 size={13} /> : <Library size={13} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function SectionRow({
  title,
  subtitle,
  items,
  pendingId,
  emptyLabel,
  actionLabel,
  onAction,
  onPrimaryAction,
  onSecondaryAction,
  onSearchSoulseek,
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {title}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs font-medium text-emerald-300 transition-colors hover:text-emerald-200"
          >
            {actionLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-5 text-sm text-slate-600">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {items.map((card) => (
            <DiscoverCard
              key={`${title}-${card.kind}-${card.artistName || 'artist'}-${card.title}`}
              card={card}
              pendingId={pendingId}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
              onSearchSoulseek={onSearchSoulseek}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChartGrid({
  chart,
  chartKind,
  chartLoading,
  pendingId,
  onSelectKind,
  onPageChange,
  onPrimaryAction,
  onSecondaryAction,
  onSearchSoulseek,
}) {
  const items = chart?.items || []
  const page = chart?.page ?? 1
  const totalPages = chart?.totalPages ?? 0
  const denseCards = chartKind === 'tracks'
  const chartCompact = chartKind !== 'tracks'
  const gridClassName = denseCards
    ? 'mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
    : 'mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  const badges = [
    'Last.fm global feed',
    `${items.length} visible`,
    `Page ${page}${totalPages > 0 ? ` of ${totalPages}` : ''}`,
  ]

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-slate-800/70 bg-[linear-gradient(165deg,rgba(17,24,39,0.72),rgba(9,12,16,0.96))] shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <ExplorerHeader
        eyebrow="Chart Explorer"
        accentClassName={explorerAccent(chartKind)}
        title={chartKind === 'artists' ? 'Top Artists' : 'Top Tracks'}
        description="Browse deeper pages from Last.fm's anonymous global charts with a cleaner full-grid view."
        badges={badges}
      >
        <div className="inline-flex rounded-full border border-slate-700/70 bg-slate-950/50 p-1">
          <ModeButton active={chartKind === 'artists'} onClick={() => onSelectKind('artists')}>
            Artists
          </ModeButton>
          <ModeButton active={chartKind === 'tracks'} onClick={() => onSelectKind('tracks')}>
            Tracks
          </ModeButton>
        </div>
      </ExplorerHeader>

      {chartLoading && !chart && (
        <div className="px-5 py-5">
          <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              Loading chart...
            </span>
          </div>
        </div>
      )}

      {!chartLoading && items.length === 0 && (
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-600">
            No chart data right now.
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="px-5 py-5">
          <div className={gridClassName}>
            {items.map((card) => (
              <DiscoverCard
                key={`chart-${chartKind}-${card.artistName || 'artist'}-${card.title}`}
                card={card}
                pendingId={pendingId}
                onPrimaryAction={onPrimaryAction}
                onSecondaryAction={onSecondaryAction}
                onSearchSoulseek={onSearchSoulseek}
                chartCompact={chartCompact}
                dense={denseCards}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={chartLoading || page <= 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-default disabled:opacity-50"
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <p className="text-xs text-slate-500">
              Page {page}
              {totalPages > 0 ? ` of ${totalPages}` : ''}
            </p>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={chartLoading || totalPages === 0 || page >= totalPages}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-default disabled:opacity-50"
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function TagChartExplorer({
  currentTag,
  selectedKind,
  chart,
  loading,
  error,
  pendingId,
  onSelectKind,
  onPageChange,
  onPrimaryAction,
  onSecondaryAction,
  onSearchSoulseek,
}) {
  const items = chart?.items || []
  const page = chart?.page ?? 1
  const totalPages = chart?.totalPages ?? 0
  const denseCards = selectedKind === 'tracks'
  const chartCompact = selectedKind !== 'tracks'
  const gridClassName = denseCards
    ? 'mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
    : 'mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  const tagName = currentTag?.tag?.name || 'this tag'
  const badges = [
    `Tag: ${tagName}`,
    `${selectedKind ? chartKindLabel(selectedKind) : 'Choose a lane'}`,
    `${items.length} visible`,
    `Page ${page}${totalPages > 0 ? ` of ${totalPages}` : ''}`,
  ]

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-slate-800/70 bg-[linear-gradient(165deg,rgba(15,23,42,0.72),rgba(7,10,14,0.96))] shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <ExplorerHeader
        eyebrow="Tag Explorer"
        accentClassName={explorerAccent(selectedKind)}
        title={selectedKind ? `Top ${chartKindLabel(selectedKind)}` : 'Browse more results'}
        description={
          selectedKind
            ? `Extended ${selectedKind} chart for ${tagName}, with artists and albums using the same compact grid density.`
            : `Choose Artists, Albums, or Tracks to open the full chart for ${tagName}.`
        }
        badges={badges}
      >
        <div className="inline-flex rounded-full border border-slate-700/70 bg-slate-950/50 p-1">
          <ModeButton active={selectedKind === 'artists'} onClick={() => onSelectKind('artists')}>
            Artists
          </ModeButton>
          <ModeButton active={selectedKind === 'albums'} onClick={() => onSelectKind('albums')}>
            Albums
          </ModeButton>
          <ModeButton active={selectedKind === 'tracks'} onClick={() => onSelectKind('tracks')}>
            Tracks
          </ModeButton>
        </div>
      </ExplorerHeader>

      {!selectedKind && (
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-500">
            Choose a section above or pick a kind here to load more results for this tag.
          </div>
        </div>
      )}

      {selectedKind && error && (
        <div className="px-5 pt-5">
          <div className="rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      {selectedKind && loading && !chart && (
        <div className="px-5 py-5">
          <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              Loading more {selectedKind}...
            </span>
          </div>
        </div>
      )}

      {selectedKind && !loading && !error && items.length === 0 && (
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-600">
            No more {selectedKind} surfaced for this tag.
          </div>
        </div>
      )}

      {selectedKind && items.length > 0 && (
        <div className="px-5 py-5">
          <div className={gridClassName}>
            {items.map((card) => (
              <DiscoverCard
                key={`tag-chart-${selectedKind}-${page}-${card.artistName || 'artist'}-${card.title}`}
                card={card}
                pendingId={pendingId}
                onPrimaryAction={onPrimaryAction}
                onSecondaryAction={onSecondaryAction}
                onSearchSoulseek={onSearchSoulseek}
                chartCompact={chartCompact}
                dense={denseCards}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-default disabled:opacity-50"
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <p className="text-xs text-slate-500">
              Page {page}
              {totalPages > 0 ? ` of ${totalPages}` : ''}
            </p>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={loading || totalPages === 0 || page >= totalPages}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-default disabled:opacity-50"
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default function DiscoverPanel({
  discover,
  onOpenArtist,
  onOpenAlbum,
  onPlayTrack,
  onSearchSoulseek,
}) {
  const {
    enabled,
    mode,
    chartKind,
    topTags,
    trendingArtists,
    trendingTracks,
    currentChart,
    currentTag,
    currentTagCharts,
    expandedTagKind,
    query,
    soulseekSeedQuery,
    loading,
    tagLoading,
    error,
    chartLoading,
    tagChartLoading,
    tagChartErrors,
    setQuery,
    setSoulseekSeedQuery,
    searchTag,
    showTag,
    showGlobal,
    loadChartPage,
    showTagChart,
    loadTagChartPage,
  } = discover
  const [pendingId, setPendingId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const chartExplorerRef = useRef(null)
  const tagExplorerRef = useRef(null)

  const currentTagName = currentTag?.tag?.name ?? ''
  const activeTagExplorerKind = expandedTagKind ?? (currentTag ? 'artists' : null)
  const shouldBootstrapTagExplorer =
    mode === 'tags' &&
    Boolean(currentTag?.tag?.name) &&
    !expandedTagKind &&
    !currentTagCharts.artists &&
    !tagChartLoading.artists &&
    !tagChartErrors.artists
  const tagHeroMeta = useMemo(
    () =>
      [
        currentTag?.tag?.reach != null ? `${fmtCount(currentTag.tag.reach)} reach` : null,
        currentTag?.tag?.total != null ? `${fmtCount(currentTag.tag.total)} total uses` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    [currentTag]
  )

  useEffect(() => {
    if (!shouldBootstrapTagExplorer) return
    void showTagChart('artists').catch(() => {})
  }, [shouldBootstrapTagExplorer, showTagChart])

  const handleTagSubmit = async (e) => {
    e.preventDefault()
    await searchTag()
  }

  const handleSoulseekSubmit = async (e) => {
    e.preventDefault()
    await onSearchSoulseek(soulseekSeedQuery)
  }

  const runAction = async (id, action) => {
    setPendingId(id)
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setPendingId(null)
    }
  }

  const handlePrimaryAction = (card, actionKey) => {
    if (card.kind === 'artist') return runAction(actionKey, () => onOpenArtist(card))
    if (card.kind === 'album') return runAction(actionKey, () => onOpenAlbum(card))
    return runAction(actionKey, () => onPlayTrack(card))
  }

  const handleSecondaryAction = (card) => {
    if (card.kind === 'track' && card.albumId) {
      return runAction(String(card.albumId), () => onOpenAlbum(card))
    }

    if (card.kind === 'artist') {
      return runAction(String(card.libraryId), () => onOpenArtist(card))
    }

    return runAction(String(card.libraryId), () => onOpenAlbum(card))
  }

  const handleSearchSoulseek = (card, actionKey) =>
    runAction(actionKey, () => onSearchSoulseek(card.soulseekQuery))

  const scrollToChartExplorer = () => {
    chartExplorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleOpenGlobalExplorer = async (kind) => {
    await showGlobal(kind, { page: 1, ensurePage: true })
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(scrollToChartExplorer)
      return
    }
    scrollToChartExplorer()
  }

  const scrollToTagExplorer = () => {
    tagExplorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleOpenTagExplorer = async (kind) => {
    await showTagChart(kind)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(scrollToTagExplorer)
      return
    }
    scrollToTagExplorer()
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex-none border-b border-slate-800 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 text-amber-200">
              <Compass size={16} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Discover
              </p>
              <p className="mt-0.5 text-sm text-slate-200">Global charts and tag explorer</p>
            </div>
          </div>

          <div className="inline-flex rounded-full border border-slate-700/70 bg-slate-950/50 p-1">
            <ModeButton active={mode === 'global'} onClick={() => showGlobal(chartKind)}>
              Global Tops
            </ModeButton>
            <ModeButton active={mode === 'tags'} onClick={() => showTag()}>
              Tags
            </ModeButton>
          </div>
        </div>

        <form onSubmit={handleSoulseekSubmit} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Globe
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={soulseekSeedQuery}
              onChange={(e) => setSoulseekSeedQuery(e.target.value)}
              placeholder="Search outside your library..."
              className="sv-search-input w-full rounded-xl py-2.5 pl-9 pr-3 text-sm transition-colors"
            />
          </div>
          <button
            type="submit"
            className="sv-search-btn rounded-xl px-4 text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        {mode === 'tags' && topTags.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {topTags.map((tag) => (
              <TagChip
                key={tag.name}
                tag={tag}
                active={tag.name === currentTagName}
                onClick={(nextTag) => showTag(nextTag)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!loading && !error && !enabled && (
          <div className="rounded-[1.6rem] border border-slate-800/70 bg-[linear-gradient(160deg,rgba(17,24,39,0.8),rgba(9,11,16,0.92))] p-6 shadow-[0_24px_56px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-200">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">Last.fm discovery is disabled</p>
                <p className="mt-1 text-sm text-slate-500">
                  Add <code className="text-slate-300">LASTFM_API_KEY</code> to your SoundVault
                  environment and restart the app.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        )}

        {enabled && !error && mode === 'global' && (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[1.8rem] border border-slate-800/70 bg-[linear-gradient(150deg,rgba(18,34,32,0.78),rgba(27,19,17,0.72),rgba(10,14,20,0.96))] shadow-[0_28px_70px_rgba(0,0,0,0.32)]">
              <div className="border-b border-slate-800/60 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
                      Global Charts
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
                      Last.fm Global Tops
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                      Use the anonymous global feed to scout what is rising right now, then switch
                      to Tags when you want a tighter genre lane.
                    </p>
                  </div>
                  <div className="flex min-w-[11rem] flex-col gap-2 rounded-[1.4rem] border border-white/6 bg-black/20 p-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2 text-emerald-100">
                      <Radio size={13} />
                      Home friendly
                    </span>
                    <span>These sections also power the refreshed Home dashboard.</span>
                    <span>Missing tracks or artists can jump straight to Soulseek.</span>
                  </div>
                </div>
              </div>
            </section>

            <SectionRow
              title="Top Artists"
              subtitle="Preview the global artist chart before opening the full explorer."
              items={trendingArtists || []}
              pendingId={pendingId}
              emptyLabel="No artist data right now."
              actionLabel="See more"
              onAction={() => handleOpenGlobalExplorer('artists')}
              onPrimaryAction={handlePrimaryAction}
              onSecondaryAction={handleSecondaryAction}
              onSearchSoulseek={handleSearchSoulseek}
            />

            <SectionRow
              title="Top Tracks"
              subtitle="Play local matches or branch out through Soulseek."
              items={trendingTracks || []}
              pendingId={pendingId}
              emptyLabel="No track data right now."
              actionLabel="See more"
              onAction={() => handleOpenGlobalExplorer('tracks')}
              onPrimaryAction={handlePrimaryAction}
              onSecondaryAction={handleSecondaryAction}
              onSearchSoulseek={handleSearchSoulseek}
            />

            <div ref={chartExplorerRef}>
              <ChartGrid
                chart={currentChart}
                chartKind={chartKind}
                chartLoading={chartLoading}
                pendingId={pendingId}
                onSelectKind={(kind) => showGlobal(kind)}
                onPageChange={(page) => loadChartPage(page, chartKind)}
                onPrimaryAction={handlePrimaryAction}
                onSecondaryAction={handleSecondaryAction}
                onSearchSoulseek={handleSearchSoulseek}
              />
            </div>
          </div>
        )}

        {enabled && !error && mode === 'tags' && (
          <div className="space-y-6">
            <form onSubmit={handleTagSubmit} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by tag..."
                className="sv-search-input flex-1 rounded-xl px-3 py-2.5 text-sm transition-colors"
              />
              <button
                type="submit"
                className="sv-search-btn flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                title="Search tag"
              >
                {tagLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </form>

            {!currentTag && (
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-10 text-sm text-slate-600">
                Pick a top tag or search for one.
              </div>
            )}

            {currentTag && (
              <>
                <section className="overflow-hidden rounded-[1.8rem] border border-slate-800/70 bg-[linear-gradient(150deg,rgba(36,24,20,0.72),rgba(13,18,24,0.92))] shadow-[0_28px_70px_rgba(0,0,0,0.32)]">
                  <div className="border-b border-slate-800/60 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
                          Selected Tag
                        </p>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
                          {currentTag.tag?.name || 'Discover'}
                        </h2>
                        {tagHeroMeta && (
                          <p className="mt-2 text-sm text-slate-400">{tagHeroMeta}</p>
                        )}
                        {currentTag.tag?.summary && (
                          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            {currentTag.tag.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex min-w-[11rem] flex-col gap-2 rounded-[1.4rem] border border-white/6 bg-black/20 p-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-2 text-amber-100">
                          <Radio size={13} />
                          Tag signals
                        </span>
                        <span>Top artists, albums, and tracks for the active tag.</span>
                        <span>Open local matches or jump straight to Soulseek.</span>
                      </div>
                    </div>

                    {currentTag.similarTags?.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {currentTag.similarTags.map((tag) => (
                          <TagChip
                            key={tag.name}
                            tag={tag}
                            active={tag.name === currentTagName}
                            onClick={(nextTag) => showTag(nextTag)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <SectionRow
                  title="Top Artists"
                  subtitle="Open local matches or send missing artists to Soulseek."
                  items={currentTag.topArtists || []}
                  pendingId={pendingId}
                  emptyLabel="Nothing surfaced for this tag."
                  actionLabel="See more"
                  onAction={() => handleOpenTagExplorer('artists')}
                  onPrimaryAction={handlePrimaryAction}
                  onSecondaryAction={handleSecondaryAction}
                  onSearchSoulseek={handleSearchSoulseek}
                />

                <SectionRow
                  title="Top Albums"
                  subtitle="Album cards resolve back into Navidrome whenever possible."
                  items={currentTag.topAlbums || []}
                  pendingId={pendingId}
                  emptyLabel="No albums surfaced for this tag."
                  actionLabel="See more"
                  onAction={() => handleOpenTagExplorer('albums')}
                  onPrimaryAction={handlePrimaryAction}
                  onSecondaryAction={handleSecondaryAction}
                  onSearchSoulseek={handleSearchSoulseek}
                />

                <SectionRow
                  title="Top Tracks"
                  subtitle="Play the track if it exists locally, otherwise search the release on Soulseek."
                  items={currentTag.topTracks || []}
                  pendingId={pendingId}
                  emptyLabel="No tracks surfaced for this tag."
                  actionLabel="See more"
                  onAction={() => handleOpenTagExplorer('tracks')}
                  onPrimaryAction={handlePrimaryAction}
                  onSecondaryAction={handleSecondaryAction}
                  onSearchSoulseek={handleSearchSoulseek}
                />

                <div ref={tagExplorerRef}>
                  <TagChartExplorer
                    currentTag={currentTag}
                    selectedKind={activeTagExplorerKind}
                    chart={activeTagExplorerKind ? currentTagCharts[activeTagExplorerKind] : null}
                    loading={
                      activeTagExplorerKind
                        ? tagChartLoading[activeTagExplorerKind] || shouldBootstrapTagExplorer
                        : false
                    }
                    error={activeTagExplorerKind ? tagChartErrors[activeTagExplorerKind] : null}
                    pendingId={pendingId}
                    onSelectKind={handleOpenTagExplorer}
                    onPageChange={(page) => loadTagChartPage(activeTagExplorerKind, page)}
                    onPrimaryAction={handlePrimaryAction}
                    onSecondaryAction={handleSecondaryAction}
                    onSearchSoulseek={handleSearchSoulseek}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
