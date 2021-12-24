import path, { format } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fetch } from 'undici'
import replace from 'string-replace-async'
import fs from 'fs-extra'
import romaja from 'romaja'
import slugify from 'slugify'
import templite from 'templite'
import pLimit from 'p-limit'
import normalizeUrl from 'normalize-url'
import isUrl from 'is-url'
import { from, map, lastValueFrom, toArray, mergeMap, merge, defer } from 'rxjs'
import del from 'del'
// import pkg from './package.json' assert { type: 'json' }

const pkg = fs.readJSONSync('./package.json')
const CSS_FONT_FACE_RE = /@font-face\s*{([^}]*)}/g
const CSS_URL_RE = /url\(("|'?)((?:(?<=\\)\)|[^\)])*)\1\)/g
const CSS_IMPORT_URL_RE = new RegExp(`@import\\s+${CSS_URL_RE.source};`)
const PKG_README_TEMPLATE = fs.readFileSync('pkg_readme_template', 'utf8')

const limitIO = pLimit(10)

main().catch(err => {
    console.error(err)
    process.exit(1)
})

async function main() {
    fs.ensureDirSync('packages')
    del.sync('packages/**/*')

    const fonts$ = from(iterFontDatas()).pipe(
        map((data, i) => {
            const pkgName = slugify(romaja.romanize(data.font_family_token))
                .trim()
                .replace('_', '-')
                .toLocaleLowerCase()
            return {
                pkgName,
                pkgDir: path.resolve(`packages/${pkgName}`),
                originalName: data.name,
                originalCssText: data.cdn_server_html,
                description: `${data.name} - ${data.ph_content}`,
                link: `https://noonnu.cc/font_page/${data.id}`,
            }
        })
    )
    const updatePkgs$ = fonts$.pipe(
        mergeMap(f => limitIO(() => fs.ensureDir(f.pkgDir)).then(() => f)),
        mergeMap(f =>
            merge(
                limitIO(() => writePkgFile(f)),
                limitIO(() => writeReadmeFile(f)),
                defer(async () => {
                    const newCss = await generateCss(f.originalCssText)
                    return limitIO(() => fs.writeFile(path.join(f.pkgDir, 'index.css'), newCss))

                    async function generateCss(css, baseUrl) {
                        return replaceCssImport(await replaceFonts(css, baseUrl))
                    }
                    function replaceFonts(css, baseUrl) {
                        return replace(css, CSS_FONT_FACE_RE, body =>
                            replace(body, CSS_URL_RE, async (_, __, fontUrl) => {
                                fontUrl = normalizeUrl(
                                    isUrl(fontUrl) ? fontUrl : new URL(fontUrl, baseUrl).toString(),
                                    { stripHash: true }
                                )
                                const filePath = path.join(f.pkgDir, path.basename(fontUrl))
                                await limitIO(() =>
                                    pipeline(
                                        fetch(normalizeUrl(fontUrl)).then(r => r.body.stream),
                                        fs.createWriteStream(filePath)
                                    )
                                )
                                return `url(./${path.relative(f.pkgDir, filePath)}${
                                    path.extname(fontUrl) === 'eot' ? '?#iefix' : ''
                                })`
                            })
                        )
                    }
                    function replaceCssImport(css) {
                        return replace(css, CSS_IMPORT_URL_RE, async (_, __, cssUrl) => {
                            cssUrl = normalizeUrl(cssUrl, { stripHash: true })
                            const part = await limitIO(() => fetch(cssUrl).then(r => r.text()))
                            return generateCss(part, cssUrl)
                        })
                    }
                })
            )
        )
    )
    const updateFontsMd$ = fonts$.pipe(
        toArray(),
        mergeMap(async fonts => {
            const ws = fs.createWriteStream('fonts.md')
            ws.write('# 폰트목록?!\n')
            fonts
                .sort((a, b) => a.originalName.localeCompare(b.originalName))
                .forEach(f =>
                    ws.write(
                        `- ${f.originalName} ([눈누링크](${f.link}), [저장소링크](https://github.com/skt-t1-byungi/noonnu-fonts/tree/HEAD/packages/${f.pkgName}/)) \n`
                    )
                )
            ws.end()
        })
    )

    await lastValueFrom(merge(updatePkgs$, updateFontsMd$))
}

async function* iterFontDatas() {
    let page = 1,
        data
    do {
        data = await limitIO(() => fetch(`https://noonnu.cc/font_page.json?page=${page++}`).then(r => r.json()))
        yield* data.fonts
    } while (!data.is_last_page)
}

function writePkgFile(f) {
    return fs.writeJSON(
        `./packages/${f.pkgName}/package.json`,
        {
            name: `@noonnu/${f.pkgName}`,
            description: f.description,
            version: pkg.noonnu.version,
            main: 'index.css',
            license: 'MIT',
            keywords: ['noonnu', f.originalName, f.pkgName],
            homepage: f.link,
            repository: {
                type: 'git',
                url: 'https://github.com/skt-t1-byungi/noonnu-fonts.git',
                directory: `packages/${f.pkgName}`,
            },
            publishConfig: {
                access: 'public',
            },
        },
        {
            spaces: 4,
        }
    )
}

function writeReadmeFile(f) {
    return fs.writeFile(
        path.join(f.pkgDir, 'README.md'),
        templite(PKG_README_TEMPLATE, {
            name: f.pkgName,
            description: f.description,
            link: f.link,
        })
    )
}
