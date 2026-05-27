export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 17 L5 7 L9 13 L12 7 L15 13 L19 7 L19 17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" strokeLinecap="square" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  )
}
