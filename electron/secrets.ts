import { safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * Secrets store using Electron's safeStorage (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 * Secrets are encrypted at rest in a separate file from the main JSON database.
 */

interface SecretsStore {
  [key: string]: string
}

let secrets: SecretsStore = {}
const SECRETS_FILE = 'secrets.enc'

function getSecretsPath(): string {
  return path.join(app.getPath('userData'), SECRETS_FILE)
}

export function initSecrets(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[secrets] OS encryption not available, secrets will fall back to plaintext')
  }
  loadSecrets()
}

function loadSecrets(): void {
  const filePath = getSecretsPath()
  if (!fs.existsSync(filePath)) {
    secrets = {}
    return
  }
  try {
    const raw = fs.readFileSync(filePath)
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(raw)
      secrets = JSON.parse(decrypted)
    } else {
      secrets = JSON.parse(raw.toString('utf-8'))
    }
  } catch (err) {
    console.error('[secrets] Failed to load secrets, starting fresh:', err)
    secrets = {}
  }
}

function saveSecrets(): void {
  const filePath = getSecretsPath()
  const json = JSON.stringify(secrets)
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    fs.writeFileSync(filePath, encrypted)
  } else {
    fs.writeFileSync(filePath, json, 'utf-8')
  }
}

export function getSecret(key: string): string {
  return secrets[key] || ''
}

export function setSecret(key: string, value: string): void {
  if (value) {
    secrets[key] = value
  } else {
    delete secrets[key]
  }
  saveSecrets()
}

/**
 * Migrate plaintext secrets from the JSON database into encrypted storage.
 * Call once at startup. After migration, the plaintext values are cleared from the DB.
 */
export function migrateSecretsFromDb(dbSecrets: Record<string, string>, clearCallback: (keys: string[]) => void): void {
  const migrated: string[] = []
  for (const [key, value] of Object.entries(dbSecrets)) {
    if (value && !secrets[key]) {
      secrets[key] = value
      migrated.push(key)
    }
  }
  if (migrated.length > 0) {
    saveSecrets()
    clearCallback(migrated)
    console.log(`[secrets] Migrated ${migrated.length} secrets to encrypted storage`)
  }
}
