import { exec as _exec } from 'node:child_process'
import { promisify } from 'node:util'
import { count, filter, from, lastValueFrom, mergeMap } from 'rxjs'
import { CPUS_LEN, log } from './_commons.js'

const exec = promisify(_exec)

main()

async function main() {
    const prevPkgs = new Set(Object.keys(JSON.parse((await exec('pnpm access ls-packages @noonnu')).stdout)))
    const nextPkgs = new Set(
        (JSON.parse((await exec('pnpm list --json -r')).stdout) as { name: string }[]).map(pkg => pkg.name)
    )

    log('존재하지 않는 패키지를 deprecate합니다.')
    const deprecatedCnt = await lastValueFrom(
        from(prevPkgs).pipe(
            filter(pkg => !nextPkgs.has(pkg)),
            mergeMap(
                pkg =>
                    exec(`pnpm deprecate ${pkg}@"*" "deprecated"`).then(
                        () => log('~>', pkg),
                        // 이미 deprecated된 패키지는 에러가 발생합니다. 무시합니다.
                        console.warn
                    ),
                CPUS_LEN
            ),
            count()
        )
    )
    log(`총 ${deprecatedCnt}개의 패키지를 deprecate했습니다.`)

    log('패키지들을 publish합니다.')
    await exec('pnpm publish -r --access public --no-git-checks')
}
