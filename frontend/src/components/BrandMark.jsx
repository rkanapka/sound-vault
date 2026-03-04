import { useId } from 'react'

export default function BrandMark({ className = 'w-6 h-6' }) {
  const id = useId().replace(/:/g, '')
  const bg = `sv-brand-bg-${id}`
  const glow = `sv-brand-glow-${id}`

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#95d09a" />
          <stop offset="1" stopColor="#495f49" />
        </linearGradient>
        <radialGradient
          id={glow}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(20 18) rotate(50) scale(30 28)"
        >
          <stop offset="0" stopColor="#eef7ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#eef7ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${bg})`} />
      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${glow})`} />

      <path
        d="M13 39c4.8 0 4.8-14 9.6-14s4.8 14 9.6 14 4.8-14 9.6-14 4.8 14 9.6 14"
        fill="none"
        stroke="#f4faf4"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="47.5" cy="20.5" r="4.4" fill="#f4faf4" opacity="0.9" />
    </svg>
  )
}
