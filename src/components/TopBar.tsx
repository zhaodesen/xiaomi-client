import { Logo } from './Logo'
import type { ModeId } from '@/types'

const TITLES: Record<ModeId, string> = {
  image: '图片解析',
  audio: '音频解析',
  video: '视频解析',
  tts: '语音合成',
  download: '下载素材',
  settings: '设置'
}

interface Props {
  mode: ModeId
  modelName: string
  hasApiKey: boolean
}

export function TopBar({ mode, modelName, hasApiKey }: Props) {
  return (
    <header
      className="top-bar relative z-10 flex h-[48px] shrink-0 items-center justify-between border-b border-line-subtle bg-ink-base px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className="text-signal-lime">
          <Logo size={18} />
        </span>
        <span className="text-[14px] font-medium text-fg">MiMo 多模态</span>
        <span className="h-3 w-px bg-line-default" />
        <span className="text-[13px] text-fg-dim">{TITLES[mode]}</span>
      </div>

      <div
        className="flex items-center gap-3 text-[12px] text-fg-dim"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span>{modelName}</span>
        <span className="flex items-center gap-1.5">
          <span className={`dot ${hasApiKey ? 'dot-on' : 'dot-warn pulse'}`} />
          {hasApiKey ? '已配置密钥' : '未配置密钥'}
        </span>
      </div>
    </header>
  )
}
