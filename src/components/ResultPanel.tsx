import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface Props {
  title?: string
  busy: boolean
  text: string | null
  error: string | null
  empty?: string
}

export function ResultPanel({ title = '结果', busy, text, error, empty }: Props) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="panel flex h-full min-h-[200px] flex-col">
      <header className="flex items-center justify-between border-b border-line-subtle px-4 py-2.5">
        <span className="text-[13px] text-fg">{title}</span>
        <div className="flex items-center gap-2">
          {busy && <span className="dot dot-warn pulse" />}
          <button type="button" className="btn btn-ghost" disabled={!text} onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-auto p-4">
        {error && (
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-signal-red">
            {error}
          </pre>
        )}
        {!error && text && (
          <article className="whitespace-pre-wrap text-[13px] leading-[1.75] text-fg">
            {text}
          </article>
        )}
        {!error && !text && (
          <div className="flex h-full items-center justify-center text-[13px] text-fg-mute">
            {busy ? '正在处理…' : empty ?? '等待输入'}
          </div>
        )}
      </div>
    </div>
  )
}
