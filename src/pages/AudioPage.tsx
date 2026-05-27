import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Dropzone, type PickedFile } from '@/components/Dropzone'
import { ResultPanel } from '@/components/ResultPanel'
import { analyzeAudio, readLocalAsDataUrl } from '@/lib/api'

interface Props {
  setBusy: (b: boolean) => void
  setStatusMessage: (m: string | null) => void
}

const PRESETS = [
  { label: '完整转写', prompt: '请将这段音频完整转写为中文文本。' },
  { label: '内容摘要', prompt: '总结这段音频的核心信息，输出 5 条要点。' },
  { label: '情感分析', prompt: '分析说话人的情绪、语速与语气特征。' },
  { label: '区分说话人', prompt: '尽力区分音频中不同说话人，并以 [说话人 A] / [说话人 B] 标注。' },
  { label: '关键词提取', prompt: '从这段音频里提取 10 个最重要的关键词或专有名词。' },
  { label: '生成会议纪要', prompt: '把这段音频整理成结构化的会议纪要，包含议题、决定、待办事项。' }
] as const

export function AudioPage({ setBusy, setStatusMessage }: Props) {
  const [file, setFile] = useState<PickedFile | null>(null)
  const [prompt, setPrompt] = useState<string>(PRESETS[0].prompt)
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setLocalBusy] = useState(false)
  const [custom, setCustom] = useState(false)

  async function run() {
    if (!file) return
    setErr(null)
    setText(null)
    setLocalBusy(true)
    setBusy(true)
    setStatusMessage('正在处理音频…')
    try {
      const r = await analyzeAudio({ prompt, path: file.path, data_url: file.dataUrl })
      setText(r.text || '（空响应）')
    } catch (e) {
      setErr(String(e))
    } finally {
      setLocalBusy(false)
      setBusy(false)
      setStatusMessage(null)
    }
  }

  async function browse() {
    const path = await window.mimo.dialog.openFile([
      { name: '音频', extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg'] }
    ])
    if (!path) return null
    const dataUrl = (await readLocalAsDataUrl(path)) ?? undefined
    return { name: path.split(/[\\/]/).pop() ?? path, size: 0, type: '', path, dataUrl }
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <section className="flex flex-col gap-4 overflow-auto pr-1">
        <Dropzone kind="audio" accept="audio/*" file={file} onPick={setFile} onBrowse={browse} />

        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between text-[12px] text-fg-dim">
            <span>处理方式</span>
            <button
              type="button"
              className="text-fg-dim hover:text-fg"
              onClick={() => setCustom((c) => !c)}
            >
              {custom ? '使用预设' : '自定义指令'}
            </button>
          </div>

          {custom ? (
            <textarea
              className="textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="告诉 MiMo 你想从这段音频里得到什么…"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(t.prompt)}
                  className={`btn ${prompt === t.prompt ? 'btn-primary' : ''}`}
                  style={{ textTransform: 'none', letterSpacing: 0 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button className="btn btn-primary" disabled={!file || busy} onClick={run}>
              <Sparkles size={13} /> 开始处理
            </button>
          </div>
        </div>
      </section>

      <ResultPanel title="处理结果" busy={busy} text={text} error={err} />
    </div>
  )
}
