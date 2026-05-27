import type { AnalyzeResponse, HealthResponse, TtsResponse } from '@/types'

let cachedBaseUrl: string | null = null

export async function sidecarBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl
  const info = await window.mimo.sidecar.info()
  if (!info) throw new Error('Sidecar not running')
  cachedBaseUrl = info.baseUrl
  return cachedBaseUrl
}

export function resetSidecarCache() {
  cachedBaseUrl = null
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = await sidecarBaseUrl()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = (j as { detail?: string }).detail ?? JSON.stringify(j)
    } catch {
      detail = await res.text()
    }
    throw new Error(`[${res.status}] ${detail || res.statusText}`)
  }
  return (await res.json()) as T
}

export async function health(): Promise<HealthResponse> {
  const base = await sidecarBaseUrl()
  const res = await fetch(`${base}/health`)
  if (!res.ok) throw new Error('Sidecar unhealthy')
  return (await res.json()) as HealthResponse
}

export interface AnalyzePayload {
  path?: string
  data_url?: string
  prompt: string
}

export const analyzeImage = (p: AnalyzePayload) =>
  postJson<AnalyzeResponse>('/analyze/image', p)
export const analyzeAudio = (p: AnalyzePayload) =>
  postJson<AnalyzeResponse>('/analyze/audio', p)
export const analyzeVideo = (p: AnalyzePayload) =>
  postJson<AnalyzeResponse>('/analyze/video', p)

export interface TtsPayload {
  text: string
  model?: string
  voice?: string
  format?: 'mp3' | 'wav' | 'ogg' | 'flac'
  speed?: number
  style_prompt?: string
  voice_description?: string
  reference_audio?: string
}

export const tts = (p: TtsPayload) => postJson<TtsResponse>('/tts', p)

/** 让 Electron 读本地文件并转 data URL，给预览用。 */
export async function readLocalAsDataUrl(
  path: string,
  limitMB = 80
): Promise<string | null> {
  const r = await window.mimo.fs.readAsDataUrl(path, limitMB)
  if (r.ok) return r.dataUrl
  return null
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid data URL')

  const mime = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3]
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}
