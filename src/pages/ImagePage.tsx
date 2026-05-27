import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Dropzone, type PickedFile } from '@/components/Dropzone'
import { ResultPanel } from '@/components/ResultPanel'
import { analyzeImage, readLocalAsDataUrl } from '@/lib/api'

interface Props {
  setBusy: (b: boolean) => void
  setStatusMessage: (m: string | null) => void
}

export function ImagePage({ setBusy, setStatusMessage }: Props) {
  const [file, setFile] = useState<PickedFile | null>(null)
  const [prompt, setPrompt] = useState('请详细描述这张图片的内容。')
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setLocalBusy] = useState(false)

  async function run() {
    if (!file) return
    setErr(null)
    setText(null)
    setLocalBusy(true)
    setBusy(true)
    setStatusMessage('正在解析图片…')
    try {
      const r = await analyzeImage({ prompt, path: file.path, data_url: file.dataUrl })
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
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
    ])
    if (!path) return null
    const dataUrl = (await readLocalAsDataUrl(path)) ?? undefined
    return { name: path.split(/[\\/]/).pop() ?? path, size: 0, type: '', path, dataUrl }
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <section className="flex flex-col gap-4 overflow-auto pr-1">
        <Dropzone kind="image" accept="image/*" file={file} onPick={setFile} onBrowse={browse} />

        <div className="panel flex flex-col gap-3 p-4">
          <textarea
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="告诉 MiMo 你想知道什么…"
          />
          <button className="btn btn-primary self-end" disabled={!file || busy} onClick={run}>
            <Sparkles size={13} /> 开始解析
          </button>
        </div>
      </section>

      <ResultPanel title="解析结果" busy={busy} text={text} error={err} />
    </div>
  )
}
