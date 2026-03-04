import { useState, useRef, useCallback, useEffect } from 'react'
import { streamUrl, scrobbleSong } from '../api'

export function usePlayer() {
  const audioRef = useRef(null)
  if (!audioRef.current) audioRef.current = new Audio()

  // Read saved playback state exactly once at mount
  const initRef = useRef(null)
  if (!initRef.current) {
    const raw = localStorage.getItem('sv-queue')
    const queue = raw ? JSON.parse(raw) : null
    const index = parseInt(localStorage.getItem('sv-queue-index') ?? '-1', 10)
    const time = parseFloat(localStorage.getItem('sv-time') ?? '0')
    initRef.current = {
      queue,
      index: isNaN(index) ? -1 : index,
      time: isNaN(time) ? 0 : time,
    }
  }

  // Refs for access inside event handlers (avoids stale closures)
  const queueRef = useRef(initRef.current.queue ?? [])
  const queueIndexRef = useRef(initRef.current.index)
  const playAtRef = useRef(null)
  const repeatRef = useRef('off') // 'off' | 'all' | 'one'
  const lastSavedTimeRef = useRef(0)

  const { queue: initQueue, index: initIndex } = initRef.current

  const [state, setState] = useState(() => ({
    song: initQueue?.[initIndex] ?? null,
    queue: initQueue ?? [],
    queueIndex: initIndex,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: parseFloat(localStorage.getItem('sv-volume') ?? '0.05'),
    repeat: 'off',
  }))

  const playAt = useCallback((queue, index) => {
    const audio = audioRef.current
    const song = queue[index]
    audio.src = streamUrl(song.id)
    audio.play().catch(console.error)
    queueRef.current = queue
    queueIndexRef.current = index
    try {
      localStorage.setItem('sv-queue', JSON.stringify(queue))
      localStorage.setItem('sv-queue-index', index)
      localStorage.setItem('sv-time', '0')
    } catch {}
    setState((s) => ({
      ...s,
      song,
      queue,
      queueIndex: index,
      playing: true,
      currentTime: 0,
      duration: 0,
    }))
  }, [])

  // Keep playAt ref current so event handlers can call the latest version
  playAtRef.current = playAt

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = parseFloat(localStorage.getItem('sv-volume') ?? '0.05')

    // Restore previous song without auto-playing
    const { queue, index, time } = initRef.current
    if (queue && index >= 0 && queue[index]) {
      audio.src = streamUrl(queue[index].id)
      audio.addEventListener(
        'loadedmetadata',
        () => {
          audio.currentTime = time
          setState((s) => ({
            ...s,
            currentTime: time,
            duration: isFinite(audio.duration) ? audio.duration : 0,
          }))
        },
        { once: true }
      )
    }

    const onTimeUpdate = () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }))
      // Throttle-save time every 5 seconds during playback
      if (audio.currentTime - lastSavedTimeRef.current > 5) {
        localStorage.setItem('sv-time', audio.currentTime)
        lastSavedTimeRef.current = audio.currentTime
      }
    }

    const onDurationChange = () =>
      setState((s) => ({ ...s, duration: isFinite(audio.duration) ? audio.duration : 0 }))

    const onEnded = () => {
      const queue = queueRef.current
      const idx = queueIndexRef.current
      const repeat = repeatRef.current
      if (queue[idx]?.id) scrobbleSong(queue[idx].id).catch(() => {})
      if (repeat === 'one') {
        const audio = audioRef.current
        audio.currentTime = 0
        audio.play().catch(console.error)
      } else if (idx < queue.length - 1) {
        playAtRef.current(queue, idx + 1)
      } else if (repeat === 'all') {
        playAtRef.current(queue, 0)
      } else {
        setState((s) => ({ ...s, playing: false }))
      }
    }

    const onPlay = () => setState((s) => ({ ...s, playing: true }))
    const onPause = () => {
      setState((s) => ({ ...s, playing: false }))
      localStorage.setItem('sv-time', audio.currentTime)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.pause()
      audio.src = ''
    }
  }, [])

  const play = useCallback((queue, index) => playAt(queue, index), [playAt])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (audio.paused) audio.play().catch(console.error)
    else audio.pause()
  }, [])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
    } else if (queueIndexRef.current > 0) {
      playAt(queueRef.current, queueIndexRef.current - 1)
    }
  }, [playAt])

  const next = useCallback(() => {
    const idx = queueIndexRef.current
    const queue = queueRef.current
    if (idx < queue.length - 1) {
      playAt(queue, idx + 1)
    }
  }, [playAt])

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time
    setState((s) => ({ ...s, currentTime: time }))
  }, [])

  const setVolume = useCallback((vol) => {
    audioRef.current.volume = vol
    localStorage.setItem('sv-volume', vol)
    setState((s) => ({ ...s, volume: vol }))
  }, [])

  const toggleRepeat = useCallback(() => {
    setState((s) => {
      const next = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off'
      repeatRef.current = next
      return { ...s, repeat: next }
    })
  }, [])

  return { ...state, play, togglePlay, prev, next, seek, setVolume, toggleRepeat }
}
