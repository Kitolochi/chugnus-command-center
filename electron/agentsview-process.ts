import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'

let avProcess: ChildProcess | null = null

export type AVProcessStatus = 'running' | 'stopped' | 'not-installed'

function getBinaryPath(): string {
  const exe = process.platform === 'win32' ? 'agentsview.exe' : 'agentsview'
  return join(homedir(), '.agentsview', 'bin', exe)
}

export function getAVProcessStatus(): AVProcessStatus {
  if (avProcess && avProcess.exitCode === null) return 'running'
  if (!existsSync(getBinaryPath())) return 'not-installed'
  return 'stopped'
}

export function startAVProcess(): void {
  if (avProcess && avProcess.exitCode === null) return // already running

  const bin = getBinaryPath()
  if (!existsSync(bin)) throw new Error('AgentsView binary not found')

  avProcess = spawn(bin, ['serve', '-port', '8090', '-no-browser'], {
    detached: false,
    stdio: 'ignore',
  })

  avProcess.on('error', (err) => {
    console.error('AgentsView process error:', err)
    avProcess = null
  })

  avProcess.on('exit', () => {
    avProcess = null
  })
}

export function stopAVProcess(): void {
  if (!avProcess) return
  try { avProcess.kill() } catch {}
  avProcess = null
}

app.on('before-quit', () => {
  stopAVProcess()
})
