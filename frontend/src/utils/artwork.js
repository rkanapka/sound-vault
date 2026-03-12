function normalizeName(value) {
  return value?.trim().toLocaleLowerCase() ?? ''
}

export function isCompilationTrack(song) {
  const trackArtist = normalizeName(
    song?.displayArtist ?? song?.artist ?? song?.artists?.[0]?.name ?? null
  )
  const albumArtist = normalizeName(
    song?.displayAlbumArtist ?? song?.albumArtist ?? song?.albumArtists?.[0]?.name ?? null
  )

  return Boolean(trackArtist && albumArtist && trackArtist !== albumArtist)
}

export function getSongArtTarget(song) {
  if (!song) return null

  const cacheKey = song.coverArt ?? song.albumId ?? song.artistId ?? ''

  if (isCompilationTrack(song) && song.artistId) {
    return {
      id: song.artistId,
      cacheKey: cacheKey ? `artist-${cacheKey}` : `artist-${song.artistId}`,
    }
  }

  if (song.albumId) {
    return { id: song.albumId, cacheKey }
  }

  if (song.coverArt) {
    return { id: song.coverArt, cacheKey: song.coverArt }
  }

  if (song.artistId) {
    return { id: song.artistId, cacheKey }
  }

  return null
}

export function getSongListArtTarget(song) {
  if (!song) return null

  return getSongArtTarget(song)
}

export function getItemArtTarget(item) {
  if (!item) return null

  const id = item.coverArt ?? item.id ?? null
  if (!id) return null

  return { id, cacheKey: item.coverArt ?? '' }
}
