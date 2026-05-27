import { Image as ImageIcon, AudioWaveform, Film, Volume2, Download, Settings2 } from 'lucide-react'
import type { ModeId } from '@/types'

interface Item {
  id: ModeId
  label: string
  Icon: typeof ImageIcon
}

const ITEMS: Item[] = [
  { id: 'image', label: '图片', Icon: ImageIcon },
  { id: 'audio', label: '音频', Icon: AudioWaveform },
  { id: 'video', label: '视频', Icon: Film },
  { id: 'tts', label: '语音', Icon: Volume2 },
  { id: 'download', label: '下载', Icon: Download },
  { id: 'settings', label: '设置', Icon: Settings2 }
]

interface Props {
  active: ModeId
  onChange: (id: ModeId) => void
}

export function SideRail({ active, onChange }: Props) {
  return (
    <nav
      aria-label="功能"
      className="relative flex w-[72px] shrink-0 flex-col border-r border-line-subtle bg-ink-base pt-2"
    >
      <ul className="flex-1">
        {ITEMS.map((item) => {
          const isActive = item.id === active
          const { Icon } = item
          return (
            <li key={item.id} className="px-2">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`group relative flex w-full flex-col items-center gap-1.5 rounded-sm py-3 transition-colors ${
                  isActive ? 'text-signal-lime' : 'text-fg-dim hover:text-fg'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 bg-signal-lime"
                  />
                )}
                <Icon size={20} strokeWidth={isActive ? 1.8 : 1.5} />
                <span className="text-[11px]">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
