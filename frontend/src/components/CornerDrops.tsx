import { useId } from 'react'

// Rounded tube shapes from the Lines → Drops arrangement at feralui.dev/gradients.
export function CornerDrops() {
  const id = useId()
  return <div className="corner-drops" aria-hidden="true">
    <svg className="corner-drop corner-drop-top-right" viewBox="0 0 320 220" fill="none" stroke={`url(#${id}-top)`} strokeLinecap="round" focusable="false">
      <defs>
        <linearGradient id={`${id}-top`} gradientUnits="userSpaceOnUse" x1="320" y1="0" x2="0" y2="220">
          <stop stopColor="var(--drop-edge)" />
          <stop offset="1" stopColor="var(--drop-inner)" />
        </linearGradient>
      </defs>
      <path d="M242 38 A37 37 0 1 0 296 45" strokeWidth="28" transform="rotate(22 269 70)" />
      <path d="M24 37 H72 A16 16 0 0 1 72 69 H24" strokeWidth="20" transform="rotate(-24 48 53)" />
      <rect x="136" y="91" width="48" height="48" rx="11" strokeWidth="20" transform="rotate(17 160 115)" />
      <path d="M269 169 V189" strokeWidth="20" transform="rotate(32 269 179)" />
    </svg>
    <svg className="corner-drop corner-drop-bottom-right" viewBox="0 0 320 220" fill="none" stroke={`url(#${id}-bottom)`} strokeLinecap="round" focusable="false">
      <defs>
        <linearGradient id={`${id}-bottom`} gradientUnits="userSpaceOnUse" x1="320" y1="220" x2="0" y2="0">
          <stop stopColor="var(--drop-edge)" />
          <stop offset="1" stopColor="var(--drop-inner)" />
        </linearGradient>
      </defs>
      <path d="M248 106 C280 90 292 117 279 136 C262 161 275 188 310 176" strokeWidth="27" transform="rotate(-24 279 141)" />
      <rect x="39" y="142" width="48" height="48" rx="11" strokeWidth="21" transform="rotate(-16 63 166)" />
      <path d="M157 69 C158 94 172 107 196 99" strokeWidth="23" transform="rotate(-18 176 86)" />
      <path d="M151 177 H171" strokeWidth="18" transform="rotate(28 161 177)" />
    </svg>
  </div>
}
