// Type declarations exposed to the renderer through contextBridge.
import type { MimoApi } from './index'

declare global {
  interface Window {
    mimo: MimoApi
  }
}

export {}
