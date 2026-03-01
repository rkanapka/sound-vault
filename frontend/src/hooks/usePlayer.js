import { useState, useRef, useCallback, useEffect } from 'react'
import { streamUrl } from '../api'

export function usePlayer() {
  const audioRef = useRef(null)
  if (!audioRef.current) audioRef.current = new Audio()

  // Refs for access inside event handlers (avoids stale closures)
  const queueRef = useRef([])
  const queueIndexRef = useRef(-1)
  const playAtRef = useRef(null)
  const repeatRef = useRef('off') // 'off' | 'all' | 'one'

  const [state, setState] = useState({
    song: null,
    queue: [],
    queueIndex: -1,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    repeat: 'off',
  })

  const playAt = useCallback((queue, index) => {
    const audio = audioRef.current
    const song = queue[index]
    audio.src = streamUrl(song.id)
    audio.play().catch(console.error)
    queueRef.current = queue
    queueIndexRef.current = index
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
    audio.volume = 0.8

    const onTimeUpdate = () => setState((s) => ({ ...s, currentTime: audio.currentTime }))

    const onDurationChange = () =>
      setState((s) => ({ ...s, duration: isFinite(audio.duration) ? audio.duration : 0 }))

    const onEnded = () => {
      const queue = queueRef.current
      const idx = queueIndexRef.current
      const repeat = repeatRef.current
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
    const onPause = () => setState((s) => ({ ...s, playing: false }))

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
