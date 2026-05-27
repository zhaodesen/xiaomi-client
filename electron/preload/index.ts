import { contextBridge, ipcRenderer } from 'electron'

export interface SidecarInfo {
  baseUrl: string
  host: string
  port: number
}

export interface PublicConfig {
  baseUrl: string
  modelMultimodal: string
  modelTts: string
  hasApiKey: boolean
}

const api = {
  sidecar: {
    info: (): Promise<SidecarInfo | null> => ipcRenderer.invoke('sidecar:info')
  },
  config: {
    get: (): Promise<PublicConfig> => ipcRenderer.invoke('config:get'),
    set: (patch: Partial<{ apiKey: string; baseUrl: string; modelMultimodal: string; modelTts: string }>) =>
      ipcRenderer.invoke('config:set', patch)
  },
  dialog: {
    openFile: (filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:openFile', filters) as Promise<string | null>,
    openDir: () => ipcRenderer.invoke('dialog:openDir') as Promise<string | null>,
    saveFile: (defaultName: string, filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:saveFile', defaultName, filters) as Promise<string | null>
  },
  app: {
    getPath: (name: 'downloads' | 'userData' | 'home' | 'documents' | 'desktop') =>
      ipcRenderer.invoke('app:getPath', name) as Promise<string | null>
  },
  shell: {
    openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p) as Promise<string>,
    showItemInFolder: (p: string) => ipcRenderer.invoke('shell:showItemInFolder', p) as Promise<void>
  },
  fs: {
    writeBase64: (path: string, base64: string) =>
      ipcRenderer.invoke('fs:writeBase64', path, base64) as Promise<{ ok: true; bytes: number }>,
    readAsDataUrl: (path: string, limitMB?: number) =>
      ipcRenderer.invoke('fs:readAsDataUrl', path, limitMB) as Promise<
        | { ok: true; dataUrl: string; size: number; mime: string }
        | { ok: false; reason: string; size?: number }
      >
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check') as Promise<{ ok: boolean; info?: unknown; reason?: string }>,
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onEvent: (handler: (e: { type: string; [k: string]: unknown }) => void) => {
      const listener = (_evt: unknown, payload: { type: string }) => handler(payload as never)
      ipcRenderer.on('updater:event', listener)
      return () => ipcRenderer.removeListener('updater:event', listener)
    }
  }
}

contextBridge.exposeInMainWorld('mimo', api)

export type MimoApi = typeof api
