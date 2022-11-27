import { spawn, exec as _exec } from 'node:child_process'
import process from 'node:process'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { difference } from 'ramda'
import { filter, from, lastValueFrom, mergeMap } from 'rxjs'
import { CPUS_LEN, log } from './_utils.js'

const exec = promisify(_exec)

main()

async function main() {
    const prevPkgs = new Set(Object.keys(JSON.parse((await exec('pnpm access ls-packages @noonnu')).stdout)))
    const nextPkgs = new Set(
        (JSON.parse((await exec('pnpm list --json -r')).stdout) as { name: string }[]).map(pkg => pkg.name)
    )

    log('존재하지 않는 패키지를 게시 중단합니다.')
    await lastValueFrom(
        from(prevPkgs).pipe(
            filter(pkg => !nextPkgs.has(pkg)),
            mergeMap(async pkg => {
                await exec(`pnpm unpublish ${pkg} --dry-run -f`)
                log('~>', pkg)
            }, CPUS_LEN)
        )
    )
}
