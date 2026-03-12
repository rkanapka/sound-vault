import { useMemo, useState } from 'react'
import {
  Compass,
  Disc3,
  Library,
  Loader2,
  Mic2,
  Music4,
  Radio,
  Search,
  Sparkles,
} from 'lucide-react'
import { artUrl } from '../api'

const LASTFM_PLACEHOLDER_IMAGE_NAMES = new Set(['2a96cbd8b46e442fc41c2b86b821562f.png'])

function fmtCount(value) {
  if (value == null) return null
  return new Intl.NumberFormat().format(value)
}

function normalizeCardImage(url) {
  const value = String(url || '').trim()
  if (!value) return null

  const filename = value.split('/').pop()?.split('?')[0]?.toLowerCase() ?? ''
  if (LASTFM_PLACEHOLDER_IMAGE_NAMES.has(filename)) return null

  return value
}

function getFallbackArt(card) {
  const id =
    card.kind === 'artist'
      ? card.artistId
      : card.kind === 'album'
        ? card.albumId
        : card.albumId || card.artistId || card.songId

  return id ? artUrl(id, 320, `${card.kind}-${id}`) : null
}

function cardIcon(kind) {
  if (kind === 'artist') return Mic2
  if (kind === 'album') return Disc3
  return Music4
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
      {tag.count != null && (
        <span className="ml-1.5 text-[10px] text-slate-500">{fmtCount(tag.count)}</span>
      )}
    </button>
  )
}

function SectionRow({
  title,
  subtitle,
  items,
  pendingId,
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
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-5 text-sm text-slate-600">
          Nothing surfaced for this tag.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {items.map((card) => {
            const Icon = cardIcon(card.kind)
            const imageSrc = normalizeCardImage(card.imageUrl) || getFallbackArt(card)
            const actionKey = card.inLibrary
              ? String(card.libraryId ?? `${card.kind}:${card.title}`)
              : `search:${card.kind}:${card.soulseekQuery}`
            const isPending = pendingId === actionKey

            return (
              <article
                key={`${card.kind}-${card.artistName || 'artist'}-${card.title}`}
                className="flex-none w-56 rounded-[1.4rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(19,22,23,0.88),rgba(10,12,13,0.96))] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              >
                <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80">
                  {imageSrc ? (
                    <img src={imageSrc} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_55%,#020617_100%)] text-slate-600 flex items-center justify-center">
                      <Icon size={30} strokeWidth={1.5} />
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

                <div className="mt-3 min-h-[4rem]">
                  <p className="text-sm font-medium leading-snug text-slate-100 line-clamp-2">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
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
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
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
                      className="rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                      title={card.kind === 'track' ? 'Open album' : 'Open in library'}
                    >
                      {card.kind === 'track' ? <Disc3 size={13} /> : <Library size={13} />}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DiscoverPanel({
  discover,
  onOpenArtist,
  onOpenAlbum,
  onPlayTrack,
  onSearchSoulseek,
}) {
  const { enabled, topTags, currentTag, query, loading, error, setQuery, searchTag, loadTag } =
    discover
  const [pendingId, setPendingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const currentTagName = currentTag?.tag?.name ?? ''
  const heroMeta = useMemo(
    () =>
      [
        currentTag?.tag?.reach != null ? `${fmtCount(currentTag.tag.reach)} reach` : null,
        currentTag?.tag?.total != null ? `${fmtCount(currentTag.tag.total)} total uses` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    [currentTag]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    await searchTag()
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

  return (
    <section className="flex flex-1 min-h-0 min-w-0 flex-col">
      <div className="flex-none border-b border-slate-800 p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 text-amber-200">
            <Compass size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Discover
            </p>
            <p className="mt-0.5 text-sm text-slate-200">Last.fm tag explorer</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by tag…"
            className="sv-search-input flex-1 rounded-xl px-3 py-2.5 text-sm transition-colors"
          />
          <button
            type="submit"
            className="sv-search-btn flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
            title="Search tag"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </form>

        {topTags.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {topTags.map((tag) => (
              <TagChip
                key={tag.name}
                tag={tag}
                active={tag.name === currentTagName}
                onClick={(nextTag) => loadTag(nextTag)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && !currentTag && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-950/40 px-4 py-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              Loading discover view…
            </div>
          </div>
        )}

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

        {enabled && currentTag && (
          <div className="space-y-6">
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
                    {heroMeta && <p className="mt-2 text-sm text-slate-400">{heroMeta}</p>}
                    {currentTag.tag?.summary && (
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                        {currentTag.tag.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-[11rem] flex-col gap-2 rounded-[1.4rem] border border-white/6 bg-black/20 p-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2 text-amber-100">
                      <Radio size={13} />
                      Last.fm signals
                    </span>
                    <span>Top artists, albums, and tracks for the active tag.</span>
                    <span>Anything missing locally can jump straight to Soulseek.</span>
                  </div>
                </div>

                {currentTag.similarTags?.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {currentTag.similarTags.map((tag) => (
                      <TagChip
                        key={tag.name}
                        tag={tag}
                        active={tag.name === currentTagName}
                        onClick={(nextTag) => loadTag(nextTag)}
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
              onPrimaryAction={(card, actionKey) => runAction(actionKey, () => onOpenArtist(card))}
              onSecondaryAction={(card) =>
                runAction(String(card.libraryId), () => onOpenArtist(card))
              }
              onSearchSoulseek={(card, actionKey) =>
                runAction(actionKey, () => onSearchSoulseek(card.soulseekQuery))
              }
            />

            <SectionRow
              title="Top Albums"
              subtitle="Album cards resolve back into Navidrome whenever possible."
              items={currentTag.topAlbums || []}
              pendingId={pendingId}
              onPrimaryAction={(card, actionKey) => runAction(actionKey, () => onOpenAlbum(card))}
              onSecondaryAction={(card) =>
                runAction(String(card.libraryId), () => onOpenAlbum(card))
              }
              onSearchSoulseek={(card, actionKey) =>
                runAction(actionKey, () => onSearchSoulseek(card.soulseekQuery))
              }
            />

            <SectionRow
              title="Top Tracks"
              subtitle="Play the track if it exists locally, otherwise search the release on Soulseek."
              items={currentTag.topTracks || []}
              pendingId={pendingId}
              onPrimaryAction={(card, actionKey) => runAction(actionKey, () => onPlayTrack(card))}
              onSecondaryAction={(card) =>
                card.albumId ? runAction(card.albumId, () => onOpenAlbum(card)) : Promise.resolve()
              }
              onSearchSoulseek={(card, actionKey) =>
                runAction(actionKey, () => onSearchSoulseek(card.soulseekQuery))
              }
            />
          </div>
        )}
      </div>
    </section>
  )
}
