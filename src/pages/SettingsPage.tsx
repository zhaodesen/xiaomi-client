import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { resetSidecarCache } from '@/lib/api'

interface Props {
  onConfigChanged: () => void
}

export function SettingsPage({ onConfigChanged }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.xiaomimimo.com/v1')
  const [modelMultimodal, setModelMultimodal] = useState('mimo-v2.5')
  const [modelTts, setModelTts] = useState('mimo-v2.5-tts')
  const [revealKey, setRevealKey] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const cfg = await window.mimo.config.get()
    setBaseUrl(cfg.baseUrl)
    setModelMultimodal(cfg.modelMultimodal)
    setModelTts(cfg.modelTts)
    setHasKey(cfg.hasApiKey)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await window.mimo.config.set({
        apiKey: apiKey || undefined,
        baseUrl,
        modelMultimodal,
        modelTts
      } as never)
      resetSidecarCache()
      setApiKey('')
      onConfigChanged()
      await refresh()
      setMessage('已保存，服务已重启')
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3500)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col gap-4 overflow-auto pr-1">
      <div className="panel p-5">
        <div className="mb-4 text-[14px] text-fg">小米 MiMo 凭据</div>

        <Field label="API Key">
          <div className="flex items-center gap-2">
            <input
              type={revealKey ? 'text' : 'password'}
              className="input"
              placeholder={hasKey ? '已保存，留空不修改' : '请输入 sk-…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" onClick={() => setRevealKey((s) => !s)}>
              {revealKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>

        <button
          type="button"
          onClick={() => setAdvancedOpen((s) => !s)}
          className="-mx-1 mb-1 flex w-full items-center justify-between rounded-sm px-1 py-1.5 text-[12px] text-fg-dim hover:text-fg"
        >
          <span>高级设置</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {advancedOpen && (
          <div className="mb-2 border-t border-line-subtle pt-4">
            <Field label="服务地址">
              <input
                className="input"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="多模态模型">
                <input
                  className="input"
                  value={modelMultimodal}
                  onChange={(e) => setModelMultimodal(e.target.value)}
                />
              </Field>
              <Field label="语音模型">
                <input
                  className="input"
                  value={modelTts}
                  onChange={(e) => setModelTts(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] text-fg-dim">
            {message ?? '密钥仅保存在本机，不会上传'}
          </span>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            <Save size={13} /> 保存
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 text-[12px] text-fg-dim">{label}</div>
      {children}
    </label>
  )
}
