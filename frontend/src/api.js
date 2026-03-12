async function apiFetch(method, path, body) {
  const opts = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }
  const res = await fetch(path, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return null
}

// --- Soulseek ---
export const searchSoulseek = (query) => apiFetch('POST', '/api/soulseek/search', { query })

export const pollSearch = (id) => apiFetch('GET', `/api/soulseek/search/${id}`)

export const stopSearch = (id) => apiFetch('DELETE', `/api/soulseek/search/${id}`)

export const downloadFile = (username, filename, size) =>
  apiFetch('POST', '/api/soulseek/download', { username, filename, size })

// --- Library ---
export const getArtists = () => apiFetch('GET', '/api/library/artists')
export const getArtist = (id) => apiFetch('GET', `/api/library/artist/${id}`)
export const getAlbum = (id) => apiFetch('GET', `/api/library/album/${id}`)
export const getSong = (id) => apiFetch('GET', `/api/library/song/${id}`)
export const searchLibrary = (q) =>
  apiFetch('GET', `/api/library/search?q=${encodeURIComponent(q)}`)
export const getAlbumList = (type, size = 20, offset = 0) =>
  apiFetch(
    'GET',
    `/api/library/album-list?type=${encodeURIComponent(type)}&size=${size}&offset=${offset}`
  )
export const triggerScan = () => apiFetch('POST', '/api/library/scan')
export const getScanStatus = () => apiFetch('GET', '/api/library/scan-status')
export const deleteSong = (id) => apiFetch('DELETE', `/api/library/song/${id}`)
export const scrobbleSong = (id) =>
  apiFetch('POST', `/api/library/scrobble?id=${encodeURIComponent(id)}`)

// --- Discover ---
export const getDiscoverBootstrap = () => apiFetch('GET', '/api/discover/bootstrap')
export const getDiscoverTag = (tag) =>
  apiFetch('GET', `/api/discover/tag/${encodeURIComponent(tag)}`)

// --- Playlists ---
export const getPlaylists = () => apiFetch('GET', '/api/library/playlists')
export const getPlaylist = (id) => apiFetch('GET', `/api/library/playlist/${id}`)
export const createPlaylist = (name, songIds = []) =>
  apiFetch('POST', '/api/library/playlists', { name, song_ids: songIds })
export const updatePlaylist = (id, patch) => apiFetch('PUT', `/api/library/playlist/${id}`, patch)
export const deletePlaylist = (id) => apiFetch('DELETE', `/api/library/playlist/${id}`)

// --- Favorites ---
export const getStarred = () => apiFetch('GET', '/api/library/starred')
export const starSong = (id) => apiFetch('POST', `/api/library/star?id=${encodeURIComponent(id)}`)
export const unstarSong = (id) =>
  apiFetch('POST', `/api/library/unstar?id=${encodeURIComponent(id)}`)

// URL helpers - used directly as <audio src> and <img src>
export const streamUrl = (id) => `/api/library/stream/${id}`
export const artUrl = (id, size = 200, cacheKey = '') => {
  const params = new URLSearchParams({ size: String(size) })
  if (cacheKey) params.set('v', cacheKey)
  return `/api/library/art/${encodeURIComponent(id)}?${params.toString()}`
}
