interface Props {
  sidecarUrl: string | null
  busy: boolean
  message: string | null
}

export function StatusBar({ sidecarUrl, busy, message }: Props) {
  const port = sidecarUrl?.split(':').pop() ?? '—'
  return (
    <footer className="relative z-10 flex h-[24px] shrink-0 items-center justify-between border-t border-line-subtle bg-ink-base px-4 text-[11px] text-fg-mute">
      <span className="flex items-center gap-1.5">
        <span className={`dot ${sidecarUrl ? 'dot-on' : 'dot-off'}`} />
        本地服务 {port}
      </span>
      <span className="flex items-center gap-2">
        {busy && <span className="text-signal-amber">处理中…</span>}
        {message && <span className="max-w-[420px] truncate text-fg-dim">{message}</span>}
      </span>
    </footer>
  )
}
