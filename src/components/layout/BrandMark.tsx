import * as React from 'react'

/** "TTP" monogram: white on brand blue (#6b9ace) — used in the sidebar and on auth pages */
export function BrandMark({ className }: { className?: string }) {
  // Unique per instance: a gradient defined inside a hidden copy would not render
  const gid = `ttp-mark-${React.useId().replace(/:/g, '')}`
  return (
    <div
      className={`shrink-0 rounded-[28%] bg-[#6b9ace] ring-1 ring-white/20 shadow-sm flex items-center justify-center ${className ?? ''}`}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="w-[62%] h-[62%]">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0)" />
            <stop offset="100%" stopColor="oklch(1 0 0)" />
          </linearGradient>
        </defs>
        {/* Stylised T over a rising road line */}
        <path d="M5 7.5h22v4H18v13.5h-4V11.5H5z" fill={`url(#${gid})`} />
        <path
          d="M4 27.5c6-1.2 10.5-4.4 14-9.5"
          stroke={`url(#${gid})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.65"
        />
      </svg>
    </div>
  )
}
