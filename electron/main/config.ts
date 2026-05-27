import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

export interface AppConfig {
  apiKey: string
  baseUrl: string
  modelMultimodal: string
  modelTts: string
}

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  baseUrl: 'https://api.xiaomimimo.com/v1',
  modelMultimodal: 'mimo-v2.5',
  modelTts: 'mimo-v2.5-tts'
}

function configPath(): string {
  return join(app.getPath('userData'), 'mimo-config.json')
}

export function readConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeConfig(next: Partial<AppConfig>): AppConfig {
  const merged = { ...readConfig(), ...next }
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(merged, null, 2), { mode: 0o600 })
  return merged
}

/** A config view that is safe to expose to the renderer (no secrets). */
export function publicConfig(): Omit<AppConfig, 'apiKey'> & { hasApiKey: boolean } {
  const cfg = readConfig()
  return {
    baseUrl: cfg.baseUrl,
    modelMultimodal: cfg.modelMultimodal,
    modelTts: cfg.modelTts,
    hasApiKey: cfg.apiKey.length > 0
  }
}
