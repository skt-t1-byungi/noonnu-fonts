import fs from 'node:fs/promises'
import path from 'node:path'
import { RegistryFileSchema, type RegistryFile } from './schema.js'

export async function ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true })
}

export async function loadRegistry(registryPath: string): Promise<RegistryFile> {
    const txt = await fs.readFile(registryPath, 'utf8')
    const json = JSON.parse(txt) as unknown
    return RegistryFileSchema.parse(json)
}

export async function saveRegistry(registryPath: string, data: RegistryFile) {
    await ensureDir(path.dirname(registryPath))
    await fs.writeFile(registryPath, `${JSON.stringify(data, null, 4)}\n`, 'utf8')
}

export function validateRegistryFileOrThrow(data: unknown): asserts data is RegistryFile {
    RegistryFileSchema.parse(data)
}

