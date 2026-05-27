import { useEffect, useRef, useState } from 'react'
import { Download as DownloadIcon, FolderOpen, FolderSearch, X } from 'lucide-react'
import { sidecarBaseUrl } from '@/lib/api'
import { bytes } from '@/lib/format'

interface Props {
  setBusy: (b: boolean) => void
  setStatusMessage: (m: string | null) => void
}

interface ProgressState {
  percent: number
  speed: string
  eta: number
  downloaded: number
  total: number
}

interface Summary {
  ok: boolean
  file_path: string
  title: string
  size: number
  error: string
}

export function DownloadPage({ setBusy, setStatusMessage }: Props) {
  const [url, setUrl] = useState('')
  const [outputDir, setOutputDir] = useState<string>('')
  const [audioOnly, setAudioOnly] = useState(false)
  const [busy, setLocalBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // 默认下载到系统的 Downloads 目录
    window.mimo.app.getPath('downloads').then((p) => {
      if (p) setOutputDir(p)
    })
  }, [])

  async function pickDir() {
    const p = await window.mimo.dialog.openDir()
    if (p) setOutputDir(p)
  }

  async function start() {
    if (!url.trim() || !outputDir) return
    setErr(null)
    setProgress(null)
    setSummary(null)
    setLocalBusy(true)
    setBusy(true)
    setStatusMessage('正在下载…')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const base = await sidecarBaseUrl()
      const resp = await fetch(`${base}/download/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ url: url.trim(), output_dir: outputDir, audio_only: audioOnly })
      })
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => '')
        throw new Error(t || `HTTP ${resp.status}`)
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          const data = JSON.parse(payload)
          handleEvent(data)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(String(e))
    } finally {
      setLocalBusy(false)
      setBusy(false)
      setStatusMessage(null)
      abortRef.current = null
    }
  }

  function handleEvent(d: Record<string, unknown>) {
    switch (d.event) {
      case 'progress':
        setProgress({
          percent: Number(d.percent) || 0,
          speed: String(d.speed || ''),
          eta: Number(d.eta) || 0,
          downloaded: Number(d.downloaded) || 0,
          total: Number(d.total) || 0
        })
        break
      case 'postprocess':
        setStatusMessage('正在合并 / 转码…')
        break
      case 'summary':
        setSummary({
          ok: Boolean(d.ok),
          file_path: String(d.file_path || ''),
          title: String(d.title || ''),
          size: Number(d.size) || 0,
          error: String(d.error || '')
        })
        if (!d.ok) setErr(String(d.error || '下载失败'))
        break
      case 'error':
        setErr(String(d.message || '下载失败'))
        break
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[680px] flex-col gap-4 overflow-auto pr-1">
      <div className="panel p-4">
        <label className="block">
          <div className="mb-1.5 text-[12px] text-fg-dim">视频 / 音频 URL</div>
          <input
            className="input"
            placeholder="粘贴 YouTube / 哔哩哔哩 / Twitter 等链接"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
          />
        </label>

        <label className="mt-4 block">
          <div className="mb-1.5 text-[12px] text-fg-dim">保存位置</div>
          <div className="flex items-center gap-2">
            <input
              className="input"
              readOnly
              value={outputDir}
              placeholder="选择一个目录…"
            />
            <button type="button" className="btn" onClick={pickDir}>
              <FolderSearch size={13} /> 选择
            </button>
          </div>
        </label>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-fg-dim">
          <input
            type="checkbox"
            className="accent-[var(--accent-lime)]"
            checked={audioOnly}
            onChange={(e) => setAudioOnly(e.target.checked)}
          />
          仅下载音频 (MP3)
        </label>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] text-fg-mute">
            使用 yt-dlp，支持 1000+ 站点
          </span>
          {busy ? (
            <button type="button" className="btn" onClick={cancel}>
              <X size={13} /> 取消
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!url.trim() || !outputDir}
              onClick={start}
            >
              <DownloadIcon size={13} /> 开始下载
            </button>
          )}
        </div>
      </div>

      {(busy || progress) && (
        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between text-[12px] text-fg-dim">
            <span>下载进度</span>
            <span className="text-fg">{(progress?.percent ?? 0).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-elev">
            <div
              className="h-full bg-signal-lime transition-[width] duration-200"
              style={{ width: `${Math.min(100, progress?.percent ?? 0)}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-fg-dim">
            <div>
              已下载 <span className="text-fg">{bytes(progress?.downloaded ?? 0)}</span>
            </div>
            <div>
              总大小 <span className="text-fg">{progress?.total ? bytes(progress.total) : '—'}</span>
            </div>
            <div>
              速度 <span className="text-fg">{progress?.speed || '—'}</span>
              {progress?.eta ? <span className="ml-2 text-fg-mute">剩余 {progress.eta}s</span> : null}
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="panel border-signal-red/40 bg-signal-red/5 p-4">
          <pre className="whitespace-pre-wrap text-[12px] text-signal-red">{err}</pre>
        </div>
      )}

      {summary?.ok && (
        <div className="panel p-4">
          <div className="mb-2 text-[13px] text-fg">下载完成</div>
          <div className="text-[12px] text-fg-dim">
            <div>
              <span className="text-fg-mute">标题：</span>
              <span className="text-fg">{summary.title || '—'}</span>
            </div>
            <div className="mt-1 break-all">
              <span className="text-fg-mute">文件：</span>
              <span className="text-fg">{summary.file_path}</span>
            </div>
            <div className="mt-1">
              <span className="text-fg-mute">大小：</span>
              <span className="text-fg">{bytes(summary.size)}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => window.mimo.shell.openPath(summary.file_path)}
            >
              打开文件
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => window.mimo.shell.showItemInFolder(summary.file_path)}
            >
              <FolderOpen size={13} /> 在文件夹中显示
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
