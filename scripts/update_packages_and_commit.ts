import { noCase } from 'change-case'
import del from 'del'
import { join } from 'desm'
import fs from 'fs-extra'
import getPort from 'get-port'
import hangulRomanization from 'hangul-romanization'
import httpServer from 'http-server'
import isUrl from 'is-url'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { URL } from 'node:url'
import { promisify } from 'node:util'
import normalizeUrl from 'normalize-url'
import postcss, { AtRule } from 'postcss'
import valueParser from 'postcss-value-parser'
import prettier from 'prettier'
import { Cluster } from 'puppeteer-cluster'
import { count, distinct, filter, from, lastValueFrom, map, merge, mergeMap } from 'rxjs'
import semver from 'semver'
import simpleGit from 'simple-git'
import slugify from 'slugify'
import { fetch } from 'undici'
import { CPUS_LEN, log } from './_commons.js'

const PACKAGES_DIR = join(import.meta.url, '../packages')

const git = simpleGit()

Promise.resolve().then(main).catch(console.error)

type FontMeta = {
    name: string
    dir: string
    originalName: string
    description: string
    familyName: string
    originalCssText: string
    link: string
}

async function main() {
    log('start')
    const prevPkgs = new Set(await getPrevPkgsFromGit()) // git에서 가져오기 때문에 파일트리가 변경되기 전에 가져옵니다.
    const newPkgs = new Set<string>()

    log('눈누 폰트 데이터를 가져옵니다')
    const fontMetasByPkgName = new Map<string, FontMeta>()
    await lastValueFrom(
        from(asyncIterateFontDatas()).pipe(
            mergeMap(async f => {
                const name = slugify(noCase(hangulRomanization.convert(f.font_family_token)), {
                    lower: true,
                    strict: true,
                })
                const meta = {
                    name,
                    dir: `${PACKAGES_DIR}/${name}`,
                    originalName: f.name,
                    description: `${f.name} - ${f.ph_content}`,
                    familyName: f.font_family_token,
                    originalCssText: f.cdn_server_html,
                    link: `https://noonnu.cc/font_page/${f.id}`,
                }
                fontMetasByPkgName.set(name, meta)
                if (prevPkgs.has(name)) {
                    prevPkgs.delete(name)
                } else {
                    newPkgs.add(name)
                }
                await del(`${meta.dir}/{fonts,index.css}`)
                await generatePkgFontAsset(meta.originalCssText, meta.dir)
                log('~>', meta.name)
            }, CPUS_LEN)
        )
    )
    log(`총 ${fontMetasByPkgName.size}개의 폰트를 가져왔습니다. (새 폰트: ${newPkgs.size}개)`)

    // git을 통해 변경여부를 확인하기 때문에 가장 먼저 실행합니다.
    log('변경된 패키지의 버전을 올립니다')
    await (async () => {
        await git.add(`${PACKAGES_DIR}/**/*`)
        const len = await lastValueFrom(
            from(git.diffSummary('HEAD')).pipe(
                mergeMap(
                    diff =>
                        diff.files
                            .filter(f => !f.binary)
                            .map(f => f.file.match(/(?<=packages\/)[^/]+/)?.[0])
                            .filter(Boolean) as string[]
                ),
                // rename일 경우에 대응합니다.
                // ex) {before => next}
                map(str => str.match(/\{\s?[^=]+\s?=>\s?([^}]+)\s?\}/)?.[1] ?? str),
                distinct(),
                filter(pkg => !newPkgs.has(pkg)),
                mergeMap(async pkg => {
                    await bumpUpPkgVersion(`${PACKAGES_DIR}/${pkg}/package.json`)
                    log('~>', pkg)
                }, CPUS_LEN),
                count()
            )
        )
        log(`총 ${len}개의 패키지의 버전을 올렸습니다`)
    })()

    log('게시가 중단된 패키지를 삭제합니다')
    await del([...prevPkgs], { cwd: PACKAGES_DIR })
    prevPkgs.forEach(pkg => log('~>', pkg))
    log(`총 ${prevPkgs.size}개의 패키지를 삭제했습니다`)

    log('예제 이미지를 생성하고 새 패키지의 package.json, readme.md을 생성합니다')
    await lastValueFrom(
        merge(
            // 예제 이미지를 생성합니다.
            (async () => {
                const server = await FontExamGenSever.start({ serverRoot: PACKAGES_DIR })
                try {
                    for (const pkg of await fs.readdir(PACKAGES_DIR)) {
                        const meta = fontMetasByPkgName.get(pkg)!
                        server.queue({
                            cssImportPath: `/${path.relative(PACKAGES_DIR, meta.dir)}/index.css`,
                            familyName: meta.familyName,
                            savePath: `${meta.dir}/example.png`,
                        })
                    }
                    await server.idle()
                } finally {
                    await server.close()
                }
                log('예제 이미지를 모두 생성했습니다!')
            })(),
            // 새 패키지의 package.json, README.md 생성합니다.
            from(newPkgs).pipe(
                map(name => fontMetasByPkgName.get(name)!),
                mergeMap(async meta => {
                    await Promise.all([writeNewPkgJson(meta), writeNewReadmeFile(meta)])
                    log('~>', meta.name)
                }, CPUS_LEN)
            )
        )
    )

    log('폰트목록 문서를 업데이트합니다')
    await writeFontListDocFile([...fontMetasByPkgName.values()])

    log('변경사항을 커밋합니다')
    await git.add([`${PACKAGES_DIR}/**/*`, 'README.md'])
    await git.commit('scripts: update font packages')
}

async function getPrevPkgsFromGit() {
    return (await git.raw(['ls-tree', 'HEAD', `${PACKAGES_DIR}/`, '--name-only']))
        .trim()
        .split(os.EOL)
        .map(p => p.match(/packages\/(.+)$/)?.[1])
        .filter(Boolean) as string[]
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
    const downloads = [] as Promise<void>[]

    const result = await postcss()
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
                                downloads.push(
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

    await Promise.all([fs.writeFile(`${destDir}/index.css`, prettierFormat('css', result.css)), ...downloads])
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

function isUrlFuncNode(node: valueParser.Node): node is valueParser.FunctionNode {
    return node.type === 'function' && node.value === 'url'
}

function normalizeUrlWithFile(url: string, file?: string) {
    return normalizeUrl(file && isUrl(file) ? new URL(url, file).href : url)
}

function prettierFormat(parser: prettier.BuiltInParserName, src: string) {
    return prettier.format(src, {
        ...((prettierFormat as any).rc ??= prettier.resolveConfig.sync(PACKAGES_DIR)),
        parser,
    })
}

async function bumpUpPkgVersion(pkgPath: string) {
    const json = await fs.readJSON(pkgPath)
    json.version = semver.inc(json.version, 'patch')!
    await fs.writeFile(pkgPath, prettierFormat('json-stringify', JSON.stringify(json)))
}

interface FontGenOptions {
    cssImportPath: string
    familyName: string
    savePath: string
}

class FontExamGenSever {
    static async start({ serverRoot }: { serverRoot: string }) {
        const { server } = httpServer.createServer({ root: serverRoot, cors: true }) as any
        const port = await getPort()
        const [cluster] = await Promise.all([
            Cluster.launch({
                concurrency: Cluster.CONCURRENCY_CONTEXT,
                maxConcurrency: CPUS_LEN,
            }),
            new Promise<void>(resolve => server.listen(port, resolve)),
        ])
        return new FontExamGenSever(server, cluster, port)
    }

    private constructor(
        private server: http.Server,
        private cluster: Cluster<FontGenOptions, void>,
        private port: number
    ) {
        cluster.task(async ({ page, data }) => {
            await page.setContent(
                `
                <html>
                    <head>
                        <style>
                            @import url("${new URL(data.cssImportPath, `http://127.0.0.1:${this.port}`).href}");
                            :root {
                                font-size: 42px;
                                font-family: '${data.familyName}';
                                color: #222;
                                line-height: 1.28;
                            }
                            main{
                                padding: 20px;
                                width: max-content;
                                height: max-content;
                            }
                            p{
                                font-weight: var(--w);
                                margin: 0;
                            }
                        </style>
                    </head>
                    <body>
                        <main>
                            <p style="--w:100">100 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                            <p style="--w:300">300 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                            <p style="--w:400">400 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                            <p style="--w:500">500 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                            <p style="--w:700">700 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                            <p style="--w:900">900 가나다라마바사아 abcdefg ABCDEFG 123456 !@#$%</p>
                        </main>
                    </body>
                </html>
                `,
                { waitUntil: 'networkidle0' }
            )
            await (await page.$('main'))!.screenshot({ path: data.savePath })
        })
    }

    queue(opts: FontGenOptions) {
        return this.cluster.queue(opts)
    }

    idle() {
        return this.cluster.idle()
    }

    close() {
        return Promise.all([this.cluster.close(), promisify(this.server.close.bind(this.server))()])
    }
}

function writeNewPkgJson(meta: FontMeta) {
    return fs.writeFile(
        `${meta.dir}/package.json`,
        prettierFormat(
            'json-stringify',
            JSON.stringify({
                name: `@noonnu/${meta.name}`,
                description: `${meta.name} - ${meta.description}`,
                // 생성 방법이 변경되면 모든 패키지들을 git에서 제거하고 package.json 초기 마이너 버전을 한단계 올립니다.
                // 기존 패키지들도 새로운 방법에 따라 생성하기 위해서입니다.
                // ex) 0.1.0 -> 0.2.0
                version: `0.1.0`,
                main: 'index.css',
                license: 'MIT',
                keywords: ['noonnu', meta.name, meta.originalName],
                homepage: meta.link,
                repository: {
                    type: 'git',
                    url: 'https://github.com/skt-t1-byungi/noonnu-fonts.git',
                    directory: `packages/${meta.name}`,
                },
                publishConfig: {
                    access: 'public',
                },
            })
        )
    )
}

function writeNewReadmeFile(meta: FontMeta) {
    return fs.writeFile(
        `${meta.dir}/README.md`,
        prettierFormat(
            'markdown',
            `
# @noonnu/${meta.name}
${meta.description} 

![example](./example.png)

## Install
\`\`\`bash
npm install @noonnu/${meta.name} --save
\`\`\`

### Import the CSS file

\`\`\`js
import "@noonnu/${meta.name}" // esm
// or
require("@noonnu/${meta.name}") // cjs
\`\`\`

#### [css-loader](https://github.com/webpack-contrib/css-loader)
\`\`\`css
@import url('~@noonnu/${meta.name}');
\`\`\`

## Usage
\`\`\`css
body {
    font-family: ${meta.familyName};
}
\`\`\`

## Link
${meta.link}`
        )
    )
}

function writeFontListDocFile(metas: FontMeta[]) {
    return fs.writeFile(
        join(import.meta.url, '../font_list.md'),
        prettierFormat(
            'markdown',
            `
|no|이름|예제|
|---|---|---|
${metas
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
        (meta, i) =>
            `|${i + 1}|${meta.originalName}|<a href="./packages/${
                meta.name
            }/README.md"><img width="500" src="./packages/${meta.name}/example.png"></a>|`
    )
    .join('\n')}
`
        )
    )
}
