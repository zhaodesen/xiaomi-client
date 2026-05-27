export type ModeId = 'image' | 'audio' | 'video' | 'tts' | 'download' | 'settings'

export interface AnalyzeResponse {
  text: string
  raw?: Record<string, unknown>
}

export interface TtsResponse {
  mime: string
  format: string
  data_url: string
  size: number
}

export interface HealthResponse {
  ok: boolean
  version: string
  has_api_key: boolean
  base_url: string
  model_multimodal: string
  model_tts: string
}
