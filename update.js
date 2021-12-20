import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fetch } from 'undici'
import replaceAsync from 'string-replace-async'
import fs from 'fs-extra'
import romaja from 'romaja'
import slugify from 'slugify'
import templite from 'templite'
import pLimit from 'p-limit'
import normalizeUrl from 'normalize-url'
import isUrl from 'is-url'

const CSS_FONT_FACE_RE = /@font-face\s*{([^}]*)}/g
const CSS_URL_RE = /url\(("|'?)((?:(?<=\\)\)|[^\)])*)\1\)/g
const CSS_IMPORT_URL_RE = new RegExp(`@import\\s+${CSS_URL_RE.source};`)
const PKG_README_TEMPLATE = fs.readFileSync('pkg_readme_template', 'utf8')

const limitIO = pLimit(10)
const limitPkg = pLimit(10)

main().catch(err => {
    fs.emptyDirSync('packages')
    console.error(err)
    process.exit(1)
})

async function main() {
    const fontsMdFile = fs.createWriteStream('fonts.md')
    fontsMdFile.write('# 폰트목록\n')

    for await (const data of iterFontDatas()) {
        limitPkg(async () => {
            const name = slugify(romaja.romanize(data.font_family_token)).trim().replace('_', '-').toLocaleLowerCase()
            const pkgDir = path.resolve(`packages/${name}`)
            const description = `${data.name} - ${data.ph_content}`
            const link = `https://noonnu.cc/font_page/${data.id}`

            await limitIO(() => fs.ensureDir(pkgDir))

            await Promise.all([
                limitIO(() =>
                    fs.writeJSON(
                        `./packages/${name}/package.json`,
                        {
                            name: `@noonnu/${name}`,
                            description,
                            version: '0.2.0',
                            main: 'index.css',
                            license: 'MIT',
                            keywords: ['noonnu', data.name, name],
                            homepage: `https://noonnu.cc/font_page/${data.id} `,
                            repository: {
                                type: 'git',
                                url: 'https://github.com/skt-t1-byungi/noonnu-fonts.git',
                                directory: `packages/${name}`,
                            },
                            publishConfig: {
                                access: 'public',
                            },
                        },
                        {
                            spaces: 4,
                        }
                    )
                ),
                limitIO(() =>
                    fs.writeFile(
                        path.join(pkgDir, 'README.md'),
                        templite(PKG_README_TEMPLATE, { name, description, link })
                    )
                ),
                (async () => {
                    let cssText = await (async function recur(cssText, baseUrl) {
                        const converted = await replaceAsync(cssText, CSS_FONT_FACE_RE, fontFaceBody => {
                            return replaceAsync(fontFaceBody, CSS_URL_RE, async (_, __, fontUrl) => {
                                fontUrl = normalizeUrl(
                                    isUrl(fontUrl) ? fontUrl : new URL(fontUrl, baseUrl).toString(),
                                    {
                                        stripHash: true,
                                    }
                                )
                                const filePath = path.join(pkgDir, path.basename(fontUrl))
                                await limitIO(() =>
                                    pipeline(
                                        fetch(normalizeUrl(fontUrl)).then(r => r.body.stream),
                                        fs.createWriteStream(filePath)
                                    )
                                )
                                return `url(./${path.relative(pkgDir, filePath)}${
                                    path.extname(fontUrl) === 'eot' ? '?#iefix' : ''
                                })`
                            })
                        })
                        return replaceAsync(converted, CSS_IMPORT_URL_RE, async (_, __, cssUrl) => {
                            cssUrl = normalizeUrl(cssUrl, { stripHash: true })
                            const imported = await limitIO(() => fetch(cssUrl).then(r => r.text()))
                            return recur(imported, cssUrl)
                        })
                    })(data.cdn_server_html)
                    await limitIO(() => fs.writeFile(path.join(pkgDir, 'index.css'), cssText))
                })(),
            ])

            fontsMdFile.write(
                `- ${data.name} ([눈누링크](${link}), [저장소링크](https://github.com/skt-t1-byungi/noonnu-fonts/tree/HEAD/packages/${name}/)) \n`
            )

            console.log(`created ${name}`)
        })
    }

    fontsMdFile.close()
}

async function* iterFontDatas() {
    let page = 1,
        data
    do {
        data = await limitIO(() => fetch(`https://noonnu.cc/font_page.json?page=${page++}`).then(r => r.json()))
        yield* data.fonts
    } while (!data.is_last_page)
}
