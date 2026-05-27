import { useEffect, useState } from 'react'
import { SideRail } from '@/components/SideRail'
import { TopBar } from '@/components/TopBar'
import { StatusBar } from '@/components/StatusBar'
import { ImagePage } from '@/pages/ImagePage'
import { AudioPage } from '@/pages/AudioPage'
import { VideoPage } from '@/pages/VideoPage'
import { TtsPage } from '@/pages/TtsPage'
import { DownloadPage } from '@/pages/DownloadPage'
import { SettingsPage } from '@/pages/SettingsPage'
import type { ModeId } from '@/types'

export default function App() {
  const [mode, setMode] = useState<ModeId>('image')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sidecarUrl, setSidecarUrl] = useState<string | null>(null)
  const [modelName, setModelName] = useState('mimo-v2.5')
  const [hasApiKey, setHasApiKey] = useState(false)

  async function syncConfig() {
    try {
      const [info, cfg] = await Promise.all([
        window.mimo.sidecar.info(),
        window.mimo.config.get()
      ])
      if (info) setSidecarUrl(info.baseUrl)
      setModelName(cfg.modelMultimodal)
      setHasApiKey(cfg.hasApiKey)
    } catch {
      /* sidecar 启动中，忽略 */
    }
  }

  useEffect(() => {
    void syncConfig()
    const id = setInterval(syncConfig, 4000)
    const unsub = window.mimo.updater.onEvent((e) => {
      if (e.type === 'downloaded') {
        if (confirm('已下载新版本，是否立即重启安装？')) {
          window.mimo.updater.quitAndInstall()
        }
      }
    })
    return () => {
      clearInterval(id)
      unsub()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-ink-base text-fg">
      <TopBar mode={mode} modelName={modelName} hasApiKey={hasApiKey} />
      <div className="flex flex-1 min-h-0">
        <SideRail active={mode} onChange={setMode} />
        <main className="relative flex flex-1 min-w-0 overflow-hidden p-4">
          <div className="flex h-full w-full flex-col" key={mode}>
            {mode === 'image' && <ImagePage setBusy={setBusy} setStatusMessage={setMessage} />}
            {mode === 'audio' && <AudioPage setBusy={setBusy} setStatusMessage={setMessage} />}
            {mode === 'video' && <VideoPage setBusy={setBusy} setStatusMessage={setMessage} />}
            {mode === 'tts' && <TtsPage setBusy={setBusy} setStatusMessage={setMessage} />}
            {mode === 'download' && <DownloadPage setBusy={setBusy} setStatusMessage={setMessage} />}
            {mode === 'settings' && <SettingsPage onConfigChanged={syncConfig} />}
          </div>
        </main>
      </div>
      <StatusBar sidecarUrl={sidecarUrl} busy={busy} message={message} />
    </div>
  )
}
