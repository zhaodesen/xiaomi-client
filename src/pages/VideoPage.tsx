import { useState } from 'react'
import { Sparkles, Link as LinkIcon, FileVideo, AlertTriangle } from 'lucide-react'
import { Dropzone, type PickedFile } from '@/components/Dropzone'
import { ResultPanel } from '@/components/ResultPanel'
import { analyzeVideo, readLocalAsDataUrl } from '@/lib/api'
import { bytes } from '@/lib/format'

interface Props {
  setBusy: (b: boolean) => void
  setStatusMessage: (m: string | null) => void
}

type SourceMode = 'local' | 'url'

export function VideoPage({ setBusy, setStatusMessage }: Props) {
  const [mode, setMode] = useState<SourceMode>('url')
  const [file, setFile] = useState<PickedFile | null>(null)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [prompt, setPrompt] = useState('请描述这段视频的主要内容与关键事件。')
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setLocalBusy] = useState(false)

  async function browse() {
    const path = await window.mimo.dialog.openFile([
      { name: '视频', extensions: ['mp4', 'mov', 'avi', 'wmv'] }
    ])
    if (!path) return null
    const dataUrl = (await readLocalAsDataUrl(path, 50)) ?? undefined
    return { name: path.split(/[\\/]/).pop() ?? path, size: 0, type: '', path, dataUrl }
  }

  async function run() {
    let sourcePath: string | undefined
    let sourceDataUrl: string | undefined

    if (mode === 'url') {
      if (!/^https?:\/\//i.test(remoteUrl.trim())) {
        setErr('请填写 http(s):// 开头的视频 URL')
        return
      }
      sourceDataUrl = remoteUrl.trim()
    } else {
      if (!file) {
        setErr('请先选择或拖入视频文件')
        return
      }
      sourcePath = file.path
      sourceDataUrl = file.dataUrl
    }

    setErr(null)
    setText(null)
    setLocalBusy(true)
    setBusy(true)
    setStatusMessage('正在解析视频…')
    try {
      const r = await analyzeVideo({
        prompt,
        path: sourcePath,
        data_url: sourceDataUrl
      })
      setText(r.text || '（空响应）')
    } catch (e) {
      setErr(String(e))
    } finally {
      setLocalBusy(false)
      setBusy(false)
      setStatusMessage(null)
    }
  }

  const tabs: { id: SourceMode; label: string; icon: typeof FileVideo }[] = [
    { id: 'url', label: '在线 URL', icon: LinkIcon },
    { id: 'local', label: '本地文件', icon: FileVideo }
  ]

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <section className="flex flex-col gap-4 overflow-auto pr-1">
        <div className="panel">
          <div className="flex border-b border-line-subtle">
            {tabs.map((t) => {
              const Icon = t.icon
              const active = t.id === mode
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(t.id)
                    setErr(null)
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-[12px] transition-colors ${
                    active
                      ? '-mb-px border-b-2 border-signal-lime text-signal-lime'
                      : 'text-fg-dim hover:text-fg'
                  }`}
                >
                  <Icon size={13} /> {t.label}
                </button>
              )
            })}
          </div>

          <div className="p-4">
            {mode === 'url' && (
              <div className="flex flex-col gap-2">
                <input
                  className="input"
                  placeholder="https://example.com/your-video.mp4"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  spellCheck={false}
                />
                <p className="text-[11px] text-fg-mute">
                  公网可直接访问的 https:// 地址，由 MiMo 服务端拉取。这是最稳的方式。
                </p>
              </div>
            )}

            {mode === 'local' && (
              <>
                <Dropzone
                  kind="video"
                  accept="video/*"
                  file={file}
                  onPick={setFile}
                  onBrowse={browse}
                />
                <div className="mt-3 flex items-start gap-2 rounded-sm border border-signal-amber/40 bg-signal-amber/5 p-2.5 text-[11px] leading-relaxed text-fg-dim">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-signal-amber" />
                  <div>
                    本地文件会以 Base64 传入，编码后字符串需 ≤ 50MB；官方支持 MP4、MOV、AVI、WMV。
                    如果视频变体无法识别，建议先用 ffmpeg 转换为兼容性更好的 MP4：
                    <pre className="mt-1.5 rounded-sm bg-ink-base px-2 py-1.5 text-fg">
{`ffmpeg -i input.mp4 -c:v libx264 -c:a aac -movflags +faststart out.mp4`}
                    </pre>
                  </div>
                </div>
                {file && file.size > 0 && (
                  <div className="mt-2 text-[11px] text-fg-mute">
                    文件大小约 {bytes(file.size)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="panel flex flex-col gap-3 p-4">
          <textarea
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="想从这段视频里知道什么？"
          />
          <button className="btn btn-primary self-end" disabled={busy} onClick={run}>
            <Sparkles size={13} /> 开始解析
          </button>
        </div>
      </section>

      <ResultPanel title="解析结果" busy={busy} text={text} error={err} />
    </div>
  )
}
