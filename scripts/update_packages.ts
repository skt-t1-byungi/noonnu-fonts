import { join } from 'desm'
import fs from 'fs-extra'
import hangulRomanization from 'hangul-romanization'
import isUrl from 'is-url'
import normalizeUrl from 'normalize-url'
import path from 'node:path'
import postcss, { AtRule } from 'postcss'
import valueParser from 'postcss-value-parser'
import { defer, lastValueFrom, map, mergeAll, mergeMap } from 'rxjs'
import simpleGit from 'simple-git'
import slugify from 'slugify'
import { fetch } from 'undici'
import { pipeline } from 'node:stream/promises'
import prettier from 'prettier'
import del from 'del'

const git = simpleGit()

main()

async function main() {
    const prevPkgs = new Set(await fs.readdir(join(import.meta.url, '../packages')))
    const addedPkgs: string[] = []

    await lastValueFrom(
        defer(asyncIterateFontDatas).pipe(
            mergeMap(data => data.fonts),
            mergeMap(async font => {
                const name = slugify(hangulRomanization.convert(font.font_family_token), { lower: true, strict: true })
                if (prevPkgs.has(name)) {
                    prevPkgs.delete(name)
                } else {
                    addedPkgs.push(name)
                }
                const pkgDir = join(import.meta.url, `../packages/${name}`)
                await del([path.join(pkgDir, 'fonts/**/*'), path.join(pkgDir, 'index.css')])
                await generatePkgFontAsset(font.cdn_server_html, pkgDir)
            }, 1)
        )
    )

    await del(`packages/{${[...prevPkgs].join(',')}}`)

    // await git.add(`packages/{${[...prevPkgs, ...addedPkgs].join(',')}}`)
    // await git.commit(`chore: update packages`)
    // await git.push()
    // console.log((await git.diffSummary('HEAD')).files)
}

async function* asyncIterateFontDatas() {
    let page = 1
    let data: {
        fonts: {
            id: number
            name: string
            style: string
            ph_content: string
            thumbnail_cdn_key: string
            is_current_users_font: boolean
            font_family_token: string
            cdn_server_html: string
            families_count: number
            company: { name: string }
        }[]
        total_count: number
        is_last_page: boolean
    }
    do {
        yield (data = (await fetch(`https://noonnu.cc/font_page.json?page=${page++}`).then(r =>
            r.json()
        )) as typeof data)
    } while (!data.is_last_page)
}

async function generatePkgFontAsset(originalCssTxt: string, destDir: string) {
    await fs.ensureDir(`${destDir}/fonts`)
    const { css } = await postcss()
        .use({
            postcssPlugin: 'noonnu',
            AtRule: {
                async import(rule, { parse }) {
                    const url = findCssImportUrl(rule)
                    rule.replaceWith(parse(await fetch(url).then(r => r.text()), { from: url }))
                },
                async 'font-face'(rule) {
                    const url = findCssFontFaceUrl(rule)
                    const filename = path.basename(url)
                    await pipeline(
                        await fetch(url).then(r => r.body || Promise.reject(new Error(`no body - ${url}`))),
                        fs.createWriteStream(path.join(destDir, `fonts/${filename}`))
                    )
                    rule.walkDecls('src', decl => {
                        decl.value = valueParser(decl.value)
                            .walk(node => {
                                if (node.type === 'function' && node.value === 'url') {
                                    node.nodes[0].value = `./fonts/${filename}`
                                }
                            })
                            .toString()
                    })
                },
            },
        })
        .process(originalCssTxt, { from: 'index.css' })
    await fs.writeFile(path.join(destDir, 'index.css'), prettier.format(css, { parser: 'css', singleQuote: true }))
}

function findCssImportUrl(rule: AtRule) {
    return normalizeUrlWithFile(extractCssUrlValue(rule.params), rule.source?.input.file)
}

function findCssFontFaceUrl(rule: AtRule) {
    let url!: string
    rule.walkDecls('src', decl => {
        url = normalizeUrlWithFile(extractCssUrlValue(decl.value), rule.source?.input.file)
        return false
    })
    return url
}

function extractCssUrlValue(value: string) {
    let url!: string
    valueParser(value).walk(node => {
        if (node.type === 'function' && node.value === 'url') {
            url = node.nodes[0].value
            return false
        }
    })
    return url
}

function normalizeUrlWithFile(url: string, file?: string) {
    return normalizeUrl(file && isUrl(file) ? new URL(url, file).href : url)
}
