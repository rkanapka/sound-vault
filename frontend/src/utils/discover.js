import { artUrl } from '../api'

const LASTFM_PLACEHOLDER_IMAGE_NAMES = new Set(['2a96cbd8b46e442fc41c2b86b821562f.png'])

export function normalizeDiscoverImage(url) {
  const value = String(url || '').trim()
  if (!value) return null

  const filename = value.split('/').pop()?.split('?')[0]?.toLowerCase() ?? ''
  if (LASTFM_PLACEHOLDER_IMAGE_NAMES.has(filename)) return null

  return value
}

export function getDiscoverFallbackArt(card, size = 320) {
  if (!card) return null

  const id =
    card.kind === 'artist'
      ? card.artistId
      : card.kind === 'album'
        ? card.albumId
        : card.albumId || card.artistId || card.songId

  return id ? artUrl(id, size, `${card.kind}-${id}`) : null
}

export function getDiscoverCardImage(card, size = 320) {
  return normalizeDiscoverImage(card?.imageUrl) || getDiscoverFallbackArt(card, size)
}
