import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { fetch } from 'undici'
import {
    ensureDir,
    loadRegistry,
    RegistryFile,
    saveRegistry,
    validateRegistryFileOrThrow,
    type EvidenceRecord,
} from '@v2/font-pipeline-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Command =
    | { name: 'help' }
    | { name: 'init'; registryPath: string }
    | { name: 'validate'; registryPath: string }
    | { name: 'evidence:snapshot'; registryPath: string; fontId: string; kind: EvidenceRecord['kind']; url: string }

main().catch(err => {
    console.error(err)
    process.exitCode = 1
})

async function main() {
    const cmd = parseArgs(process.argv.slice(2))
    if (cmd.name === 'help') {
        printHelp()
        return
    }

    if (cmd.name === 'init') {
        await ensureDir(path.dirname(cmd.registryPath))
        const initial: RegistryFile = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            fonts: [],
        }
        await saveRegistry(cmd.registryPath, initial)
        console.log(`initialized: ${cmd.registryPath}`)
        return
    }

    if (cmd.name === 'validate') {
        const reg = await loadRegistry(cmd.registryPath)
        validateRegistryFileOrThrow(reg)
        console.log('ok')
        return
    }

    if (cmd.name === 'evidence:snapshot') {
        const reg = await loadRegistry(cmd.registryPath)
        validateRegistryFileOrThrow(reg)

        const font = reg.fonts.find(f => f.id === cmd.fontId)
        if (!font) {
            throw new Error(`font not found: ${cmd.fontId}`)
        }

        const evidenceRoot = path.resolve(path.dirname(cmd.registryPath), '..', 'evidence', cmd.fontId)
        await ensureDir(evidenceRoot)

        const res = await fetch(cmd.url)
        if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
        const buf = Buffer.from(await res.arrayBuffer())

        const sha256 = createHash('sha256').update(buf).digest('hex')
        const capturedAt = new Date().toISOString()
        const filename = `${cmd.kind}-${capturedAt.replace(/[:.]/g, '-')}.html`
        const savePath = path.join(evidenceRoot, filename)
        await fs.writeFile(savePath, buf)

        const relPath = path.relative(path.dirname(cmd.registryPath), savePath)
        const ev: EvidenceRecord = { kind: cmd.kind, url: cmd.url, capturedAt, sha256, path: relPath }

        font.evidence ??= []
        font.evidence.push(ev)

        reg.generatedAt = new Date().toISOString()
        await saveRegistry(cmd.registryPath, reg)

        console.log(`saved: ${relPath}`)
        console.log(`sha256: ${sha256}`)
        return
    }
}

function parseArgs(argv: string[]): Command {
    const [cmd, ...rest] = argv
    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') return { name: 'help' }

    if (cmd === 'init') {
        const registryPath = rest[0] ?? defaultRegistryPath()
        return { name: 'init', registryPath }
    }

    if (cmd === 'validate') {
        const registryPath = rest[0] ?? defaultRegistryPath()
        return { name: 'validate', registryPath }
    }

    if (cmd === 'evidence:snapshot') {
        const [registryPath, fontId, kind, url] = rest
        if (!registryPath || !fontId || !kind || !url) return { name: 'help' }
        if (!isEvidenceKind(kind)) return { name: 'help' }
        return { name: 'evidence:snapshot', registryPath, fontId, kind, url }
    }

    return { name: 'help' }
}

function defaultRegistryPath() {
    // repo root 기준으로 동작하도록: apps/font-pipeline-cli/src → /workspace
    return path.resolve(__dirname, '../../../data/v2/registry/fonts.json')
}

function isEvidenceKind(v: string): v is EvidenceRecord['kind'] {
    return v === 'license' || v === 'homepage' || v === 'download_page' || v === 'other'
}

function printHelp() {
    console.log(`
V2 font pipeline CLI (scaffold)

Usage:
  tsx apps/font-pipeline-cli/src/index.ts <command> [args]

Commands:
  init [registryPath]
  validate [registryPath]
  evidence:snapshot <registryPath> <fontId> <license|homepage|download_page|other> <url>
`.trim())
}

