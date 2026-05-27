import { useEffect, useRef, useState } from 'react'
import { Sparkles, Play, Pause, Download, FileAudio, X } from 'lucide-react'
import { tts, dataUrlToBlob, readLocalAsDataUrl } from '@/lib/api'
import { bytes } from '@/lib/format'

interface Props {
  setBusy: (b: boolean) => void
  setStatusMessage: (m: string | null) => void
}

const VOICES = [
  { id: 'mimo_default', name: 'MiMo 默认' },
  { id: '冰糖', name: '冰糖' },
  { id: '茉莉', name: '茉莉' },
  { id: '苏打', name: '苏打' },
  { id: '白桦', name: '白桦' },
  { id: 'Mia', name: 'Mia' },
  { id: 'Chloe', name: 'Chloe' },
  { id: 'Milo', name: 'Milo' },
  { id: 'Dean', name: 'Dean' }
]

const MODELS = [
  { id: 'mimo-v2.5-tts', name: '预置音色' },
  { id: 'mimo-v2.5-tts-voicedesign', name: '音色设计' },
  { id: 'mimo-v2.5-tts-voiceclone', name: '音色克隆' }
] as const

const FORMATS = ['mp3', 'wav'] as const
type Fmt = (typeof FORMATS)[number]
type TtsModel = (typeof MODELS)[number]['id']

export function TtsPage({ setBusy, setStatusMessage }: Props) {
  const [text, setText] = useState('你好，欢迎使用 MiMo 多模态客户端。')
  const [model, setModel] = useState<TtsModel>('mimo-v2.5-tts')
  const [voice, setVoice] = useState(VOICES[0].id)
  const [format, setFormat] = useState<Fmt>('mp3')
  const [speed, setSpeed] = useState(1.0)
  const [stylePrompt, setStylePrompt] = useState('')
  const [voiceDescription, setVoiceDescription] = useState('')
  const [referenceAudio, setReferenceAudio] = useState<string | null>(null)
  const [referenceName, setReferenceName] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioSize, setAudioSize] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setLocalBusy] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioUrl?.startsWith('blob:')) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  async function generate() {
    setErr(null)
    setAudioUrl(null)
    setLocalBusy(true)
    setBusy(true)
    setStatusMessage('正在合成语音…')
    try {
      const speedHint =
        speed === 1
          ? ''
          : `语速调整为 ${speed > 1 ? '偏快' : '偏慢'}，约为正常语速的 ${speed.toFixed(2)} 倍。`
      const r = await tts({
        text,
        model,
        voice,
        format,
        speed,
        style_prompt: [stylePrompt.trim(), speedHint].filter(Boolean).join('\n'),
        voice_description: voiceDescription.trim() || undefined,
        reference_audio: referenceAudio ?? undefined
      })
      const blob = await dataUrlToBlob(r.data_url)
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setAudioSize(r.size)
    } catch (e) {
      setErr(String(e))
    } finally {
      setLocalBusy(false)
      setBusy(false)
      setStatusMessage(null)
    }
  }

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  async function save() {
    if (!audioUrl) return
    const dest = await window.mimo.dialog.saveFile(`mimo-voice.${format}`, [
      { name: format.toUpperCase(), extensions: [format] }
    ])
    if (!dest) return
    const blob = await (await fetch(audioUrl)).blob()
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    const CHUNK = 0x8000
    for (let i = 0; i < buf.length; i += CHUNK) {
      s += String.fromCharCode(...buf.subarray(i, i + CHUNK))
    }
    const base64 = btoa(s)
    await window.mimo.fs.writeBase64(dest, base64)
  }

  async function pickReferenceAudio() {
    const path = await window.mimo.dialog.openFile([
      { name: '参考音频', extensions: ['mp3', 'wav'] }
    ])
    if (!path) return
    const dataUrl = await readLocalAsDataUrl(path, 10)
    if (!dataUrl) {
      setErr('参考音频不能超过 10 MB，且仅支持 mp3 / wav。')
      return
    }
    setReferenceAudio(dataUrl)
    setReferenceName(path.split(/[\\/]/).pop() ?? path)
  }

  const canGenerate = Boolean(
    text.trim() &&
      !busy &&
      (model !== 'mimo-v2.5-tts-voicedesign' || voiceDescription.trim()) &&
      (model !== 'mimo-v2.5-tts-voiceclone' || referenceAudio)
  )

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
      <section className="flex flex-col gap-4 overflow-auto pr-1">
        <div className="panel p-4">
          <textarea
            className="textarea"
            style={{ minHeight: 160 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要朗读的文本…"
          />
          <div className="mt-1 text-right text-[11px] text-fg-mute">{text.length} 字</div>
        </div>

        <div className="panel p-4">
          <div className="mb-3 text-[12px] text-fg-dim">模型</div>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`btn ${model === m.id ? 'btn-primary' : ''}`}
                style={{ textTransform: 'none', letterSpacing: 0 }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          {model === 'mimo-v2.5-tts' && (
            <>
              <div className="mb-3 text-[12px] text-fg-dim">预置音色</div>
              <div className="flex flex-wrap gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`btn ${voice === v.id ? 'btn-primary' : ''}`}
                    style={{ textTransform: 'none', letterSpacing: 0 }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {model === 'mimo-v2.5-tts-voicedesign' && (
            <>
              <div className="mb-2 text-[12px] text-fg-dim">音色描述</div>
              <textarea
                className="textarea"
                style={{ minHeight: 96 }}
                value={voiceDescription}
                onChange={(e) => setVoiceDescription(e.target.value)}
                placeholder="例如：清亮活泼的年轻女声，语气自然，咬字清晰，略带笑意。"
              />
            </>
          )}

          {model === 'mimo-v2.5-tts-voiceclone' && (
            <>
              <div className="mb-3 text-[12px] text-fg-dim">参考音频</div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn" onClick={pickReferenceAudio}>
                  <FileAudio size={13} /> 选择 mp3 / wav
                </button>
                {referenceName && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setReferenceAudio(null)
                      setReferenceName(null)
                    }}
                    style={{ textTransform: 'none', letterSpacing: 0 }}
                  >
                    {referenceName} <X size={13} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="panel p-4">
          <div className="mb-2 text-[12px] text-fg-dim">风格指令</div>
          <textarea
            className="textarea"
            style={{ minHeight: 88 }}
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="可选：用轻快上扬的语调朗读，语气自然，有亲和力。"
          />
        </div>

        <div className="panel grid grid-cols-2 gap-4 p-4">
          <div>
            <div className="mb-2 text-[12px] text-fg-dim">格式</div>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`btn ${f === format ? 'btn-primary' : ''}`}
                  style={{ textTransform: 'none', letterSpacing: 0 }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] text-fg-dim">
              <span>语速</span>
              <span className="text-fg">×{speed.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent-lime)]"
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary self-end"
          disabled={!canGenerate}
          onClick={generate}
        >
          <Sparkles size={13} /> 开始合成
        </button>
      </section>

      <section className="panel flex flex-col">
        <header className="border-b border-line-subtle px-4 py-2.5 text-[13px] text-fg">合成结果</header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          {err && (
            <pre className="w-full whitespace-pre-wrap rounded-sm border border-signal-red/40 bg-signal-red/5 p-3 text-[12px] text-signal-red">
              {err}
            </pre>
          )}
          {!err && !audioUrl && !busy && (
            <div className="text-[13px] text-fg-mute">点击右侧"开始合成"试听</div>
          )}
          {busy && <div className="text-[13px] text-signal-amber">正在合成…</div>}

          {audioUrl && (
            <>
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
              <div className="text-[12px] text-fg-dim">已生成 · {bytes(audioSize)}</div>
              <div className="flex items-center gap-3">
                <button type="button" className="btn" onClick={toggle}>
                  {playing ? <Pause size={13} /> : <Play size={13} />}
                  {playing ? '暂停' : '播放'}
                </button>
                <button type="button" className="btn" onClick={save}>
                  <Download size={13} /> 保存为 .{format}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
