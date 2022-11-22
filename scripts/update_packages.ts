import { join } from 'desm'
import fs from 'fs-extra'
import hangulRomanization from 'hangul-romanization'
import isUrl from 'is-url'
import normalizeUrl from 'normalize-url'
import path from 'node:path'
import postcss, { AtRule } from 'postcss'
import valueParser, { FunctionNode, Node } from 'postcss-value-parser'
import { from, lastValueFrom, mergeAll, mergeMap } from 'rxjs'
import simpleGit from 'simple-git'
import slugify from 'slugify'
import { fetch } from 'undici'
import { pipeline } from 'node:stream/promises'
import prettier from 'prettier'
import del from 'del'
import puppeteer, { Browser, Page } from 'puppeteer'
import httpServer from 'http-server'
import { Server } from 'node:http'
import { URL } from 'node:url'

const PACKAGES_DIR = join(import.meta.url, '../packages')

const git = simpleGit()

async function main() {
    const prevPkgs = new Set(await fs.readdir(PACKAGES_DIR))
    const newPkgs: string[] = []
    const familyNameByPkg = new Map<string, string>()

    await lastValueFrom(
        from(asyncIterateFontDatas()).pipe(
            mergeMap(async data => {
                const pkg = slugify(hangulRomanization.convert(data.font_family_token), { lower: true, strict: true })

                if (prevPkgs.has(pkg)) {
                    prevPkgs.delete(pkg)
                } else {
                    newPkgs.push(pkg)
                }
                familyNameByPkg.set(pkg, data.font_family_token)

                const pkgDir = `${PACKAGES_DIR}/${pkg}`
                await del(`${pkgDir}/{fonts,index.css,example.png}`)
                await generatePkgFontAsset(data.cdn_server_html, pkgDir)
            })
        )
    )

    await del(`packages/{${[...prevPkgs].join(',')}}`)

    const genServer = await FontExamGenSever.start({ serverRoot: PACKAGES_DIR })
    try {
        for (const pkg of await fs.readdir(PACKAGES_DIR)) {
            await genServer.generate({
                cssImportPath: `/${pkg}/index.css`,
                familyName: familyNameByPkg.get(pkg)!,
                savePath: `${PACKAGES_DIR}/${pkg}/example.png`,
            })
        }
    } finally {
        await genServer.close()
    }

    // await git.add(`packages/{${[...prevPkgs, ...addedPkgs].join(',')}}`)
    // const changedPkgs = new Set(
    //     (await git.diffSummary('HEAD')).files.map(f => f.file.match(/(?<=packages\/)[^/]+/)?.[0]).filter(Boolean)
    // )
    // console.log(changedPkgs)
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
        data = (await fetch(`https://noonnu.cc/font_page.json?page=${page++}`).then(r => r.json())) as typeof data
        yield* data.fonts
    } while (!data.is_last_page)
}

async function generatePkgFontAsset(originalCssTxt: string, destDir: string) {
    await fs.ensureDir(`${destDir}/fonts`)

    const jobs = [] as Promise<void>[]

    const { css } = await postcss()
        .use({
            postcssPlugin: 'noonnu',
            AtRule: {
                async import(rule, { parse }) {
                    const url = findCssImportUrl(rule)
                    rule.replaceWith(parse(await fetch(url).then(r => r.text()), { from: url }))
                },
                'font-face'(rule) {
                    const weight = findCssDeclValue(rule, 'font-weight')
                    const fontName = slugify(findCssDeclValue(rule, 'font-family')!, { lower: true, strict: true })

                    rule.walkDecls('src', decl => {
                        decl.value = valueParser(decl.value)
                            .walk(node => {
                                if (!isUrlFuncNode(node)) return

                                const url = normalizeUrlWithFile(node.nodes[0].value, rule.source?.input.file)

                                let filename = weight ? `${fontName}-${weight}${path.extname(url)}` : path.basename(url)
                                if (filename.endsWith('#iefix')) {
                                    filename = filename.slice(0, -6)
                                }

                                node.nodes[0].value = `./fonts/${filename}`
                                jobs.push(
                                    fetch(url).then(async r => {
                                        if (!r.body) {
                                            throw new Error('no body')
                                        }
                                        await pipeline(r.body, fs.createWriteStream(`${destDir}/fonts/${filename}`))
                                    })
                                )
                            })
                            .toString()
                    })
                },
            },
        })
        .process(originalCssTxt, { from: 'index.css' })

    await Promise.all([
        fs.writeFile(`${destDir}/index.css`, prettier.format(css, { parser: 'css', singleQuote: true })),
        ...jobs,
    ])
}

function findCssImportUrl(rule: AtRule) {
    let url!: string
    valueParser(rule.params).walk(node => {
        if (isUrlFuncNode(node)) {
            url = node.nodes[0].value
            return false
        }
    })
    return normalizeUrlWithFile(url, rule.source?.input.file)
}

function findCssDeclValue(rule: AtRule, name: string, defaultValue?: string) {
    let ret: string | undefined
    rule.walkDecls(name, decl => {
        ret = decl.value
        return false
    })
    return ret ?? defaultValue
}

function isUrlFuncNode(node: Node): node is FunctionNode {
    return node.type === 'function' && node.value === 'url'
}

function normalizeUrlWithFile(url: string, file?: string) {
    return normalizeUrl(file && isUrl(file) ? new URL(url, file).href : url)
}

class FontExamGenSever {
    static async start({ serverRoot }: { serverRoot: string }) {
        const server = httpServer.createServer({ root: serverRoot, cors: true })
        const pWait = new Promise<void>(r => server.listen(9312, r))
        const browser = await puppeteer.launch({
            args: ['--disable-features=IsolateOrigins', '--disable-site-isolation-trials'],
        })
        const [page] = await Promise.all([browser.newPage(), pWait])
        return new FontExamGenSever(server, browser, page)
    }

    private pRunning = Promise.resolve()

    private constructor(private server: Server, private browser: Browser, private page: Page) {}

    generate({ cssImportPath, familyName, savePath }: { cssImportPath: string; familyName: string; savePath: string }) {
        return (this.pRunning = this.pRunning.then(async () => {
            await this.page.setContent(
                `
                <html>
                    <head>
                        <style>
                            @import url("${new URL(cssImportPath, `http://localhost:9312`).href}");
                            :root {
                                font-size: 42px;
                                font-family: '${familyName}';
                                color: #222;
                            }
                            div{
                                padding: 20px;
                                width: max-content;
                            }
                            p{
                                font-weight: var(--w);
                                margin: 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div>
                            <p style="--w:100">100 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                            <p style="--w:300">300 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                            <p style="--w:400">400 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                            <p style="--w:500">500 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                            <p style="--w:700">700 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                            <p style="--w:900">900 가나다라마바 abcdefg ABCDEFG 123456 !@#$%^</p>
                        </div>
                    </body>
                </html>
                `,
                { waitUntil: 'load' }
            )
            await (await this.page.$('div'))!.screenshot({ path: savePath })
        }))
    }

    close() {
        return Promise.all([this.browser.close(), new Promise<any>(r => this.server.close(r))])
    }
}

main()
