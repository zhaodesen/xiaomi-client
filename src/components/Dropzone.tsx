import { useCallback, useState } from 'react'
import { Upload, FolderOpen, X } from 'lucide-react'
import { bytes } from '@/lib/format'

export interface PickedFile {
  name: string
  size: number
  type: string
  dataUrl?: string
  path?: string
}

interface Props {
  kind: 'image' | 'audio' | 'video'
  accept: string
  file: PickedFile | null
  onPick: (file: PickedFile | null) => void
  onBrowse: () => Promise<PickedFile | null>
}

const KIND_LABEL: Record<Props['kind'], string> = {
  image: '图片',
  audio: '音频',
  video: '视频'
}

export function Dropzone({ kind, accept, file, onPick, onBrowse }: Props) {
  const [over, setOver] = useState(false)

  const readDropped = useCallback(
    (f: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        onPick({
          name: f.name,
          size: f.size,
          type: f.type,
          dataUrl: String(reader.result)
        })
      }
      reader.readAsDataURL(f)
    },
    [onPick]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) readDropped(f)
      }}
      className={`panel flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center transition-colors ${
        over ? 'border-signal-lime bg-signal-lime/5' : ''
      }`}
    >
      {file ? (
        <FilePreview file={file} kind={kind} onClear={() => onPick(null)} />
      ) : (
        <>
          <Upload size={22} className="text-fg-dim" strokeWidth={1.5} />
          <div className="text-[14px] text-fg">拖入{KIND_LABEL[kind]}文件到此</div>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const picked = await onBrowse()
              if (picked) onPick(picked)
            }}
          >
            <FolderOpen size={13} />
            选择本地文件
          </button>
        </>
      )}
    </div>
  )
}

function FilePreview({
  file,
  kind,
  onClear
}: {
  file: PickedFile
  kind: 'image' | 'audio' | 'video'
  onClear: () => void
}) {
  const src = file.dataUrl ?? ''
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {kind === 'image' && src && (
        <img
          src={src}
          alt={file.name}
          className="max-h-[180px] rounded-sm border border-line-default object-contain"
        />
      )}
      {kind === 'audio' && src && <audio src={src} controls className="w-full max-w-md" />}
      {kind === 'video' && src && (
        <video src={src} controls className="max-h-[200px] rounded-sm border border-line-default" />
      )}
      <div className="flex items-center gap-2 text-[12px] text-fg-dim">
        <span className="text-fg">{file.name}</span>
        {file.size > 0 && <span>· {bytes(file.size)}</span>}
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          <X size={12} /> 移除
        </button>
      </div>
    </div>
  )
}
