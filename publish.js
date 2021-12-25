import getAuthToken from 'registry-auth-token'
import access from 'libnpmaccess'
import fs from 'fs-extra'
import pacote from 'pacote'
import pLimit from 'p-limit'
import { publish } from 'libnpmpublish'
import npmFetch from 'npm-registry-fetch'
import { noop } from 'rxjs'

const all = Promise.all.bind(Promise)
const limit = pLimit(10)

main()

async function main() {
    const token = getAuthToken().token
    const [prevPkgs, nextPkgDirs] = await all([
        access.lsPackages('@noonnu', { token }).then(o => Object.keys(o ?? {})),
        fs.readdir('packages'),
    ])
    const deprecatePkgs = (() => {
        const set = new Set(nextPkgDirs)
        return prevPkgs.filter(pkg => !set.has(pkg.slice('@noonnu/'.length)))
    })()
    await all(
        nextPkgDirs.map(async d => {
            const relativePath = `./packages/${d}`
            const [manifest, tarball] = await all([pacote.manifest(relativePath), pacote.tarball(relativePath)])
            return limit(() => publish(manifest, tarball, { token }))
        })
    )
    await all(
        deprecatePkgs.map(async pkg => {
            const data = await limit(() => npmFetch.json(`/${pkg}`))
            Object.keys(data.versions).forEach(k => (data.versions[k].deprecated = 'Deprecated'))
            return limit(() =>
                npmFetch
                    .json(`/${pkg.replace('/', '%2f')}`, {
                        body: data,
                        method: 'PUT',
                        headers: {
                            authorization: `Bearer ${token}`,
                        },
                    })
                    .catch(noop)
            )
        })
    )
}
