import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { app } from 'electron'

export interface SidecarHandle {
  process: ChildProcess
  host: string
  port: number
  baseUrl: string
}

let current: SidecarHandle | null = null

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (!addr || typeof addr === 'string') {
        srv.close()
        reject(new Error('Could not pick free port'))
        return
      }
      const port = addr.port
      srv.close(() => resolve(port))
    })
  })
}

function resolveSidecarPath(): { cmd: string; args: string[]; isDev: boolean } {
  const isDev = !app.isPackaged
  if (isDev) {
    // Dev: run the Python source directly via "python sidecar/main.py".
    const projectRoot = join(__dirname, '..', '..')
    const entry = join(projectRoot, 'sidecar', 'main.py')
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    return { cmd: pythonCmd, args: [entry], isDev: true }
  }
  // Prod: PyInstaller binary is shipped under resources/sidecar/.
  const resourcesPath = process.resourcesPath
  const binName = process.platform === 'win32' ? 'mimo-sidecar.exe' : 'mimo-sidecar'
  const binPath = join(resourcesPath, 'sidecar', binName)
  if (!existsSync(binPath)) {
    throw new Error(`Sidecar binary not found at ${binPath}`)
  }
  return { cmd: binPath, args: [], isDev: false }
}

async function waitForHealth(baseUrl: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Sidecar did not become healthy in time. Last error: ${String(lastErr)}`)
}

export async function startSidecar(): Promise<SidecarHandle> {
  if (current) return current
  const port = await pickFreePort()
  const host = '127.0.0.1'
  const baseUrl = `http://${host}:${port}`
  const { cmd, args } = resolveSidecarPath()

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SIDECAR_HOST: host,
    SIDECAR_PORT: String(port),
    // The API key is read by the sidecar from this env var OR the user-data
    // config file written via the Settings page. We forward whatever main has.
    MIMO_API_KEY: process.env.MIMO_API_KEY ?? '',
    MIMO_BASE_URL: process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1',
    MIMO_USER_DATA_DIR: app.getPath('userData')
  }

  const child = spawn(cmd, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[sidecar] ${chunk}`)
  })
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[sidecar:err] ${chunk}`)
  })
  child.on('exit', (code, signal) => {
    console.log(`[sidecar] exited code=${code} signal=${signal}`)
    if (current?.process === child) current = null
  })

  await waitForHealth(baseUrl)
  current = { process: child, host, port, baseUrl }
  return current
}

export function getSidecar(): SidecarHandle | null {
  return current
}

export async function stopSidecar(): Promise<void> {
  if (!current) return
  const { process: child } = current
  current = null
  return new Promise((resolve) => {
    const done = () => resolve()
    child.once('exit', done)
    try {
      if (process.platform === 'win32') {
        child.kill()
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      resolve()
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL' as never)
      } catch {
        /* noop */
      }
      resolve()
    }, 3000)
  })
}
