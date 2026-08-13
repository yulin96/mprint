import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { copyFile, mkdir, open, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'
import type { PrintFontFace, PrintFontFormat } from '../shared/print-types'

const fontFormats = new Set<PrintFontFormat>(['woff2', 'woff', 'truetype', 'opentype'])
const fontExtensions: Record<PrintFontFormat, string> = {
  woff2: 'woff2',
  woff: 'woff',
  truetype: 'ttf',
  opentype: 'otf'
}
const extensionFormats: Record<string, PrintFontFormat> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype'
}
const maxFontUrlLength = 4096
const maxFontBytes = 30 * 1024 * 1024
const maxCacheBytes = 200 * 1024 * 1024
const downloadTimeoutMs = 20000
const maxRedirects = 3
const cacheFilePattern = /^([a-f0-9]{64})\.(woff2|woff|ttf|otf)$/
const fontOperations = new Map<string, Promise<void>>()
let cacheMutation: Promise<void> = Promise.resolve()
let cacheClearOperation: Promise<void> | null = null

export type CachedFont = {
  key: string
  path: string
  fileName: string
  sizeBytes: number
  version: number
  source: 'cache' | 'download'
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

function inferFontFormat(url: URL): PrintFontFormat | undefined {
  const extension = url.pathname.split('.').pop()?.toLowerCase()
  return extension ? extensionFormats[extension] : undefined
}

export function normalizeFontFace(value: unknown, label: string): PrintFontFace {
  if (!isRecord(value)) throw new Error(`${label} 参数不正确。`)
  const fontFamily = typeof value.fontFamily === 'string' ? value.fontFamily.trim() : ''
  const src = typeof value.src === 'string' ? value.src.trim() : ''
  if (
    !fontFamily ||
    fontFamily.length > 200 ||
    hasControlCharacter(fontFamily) ||
    !src ||
    src.length > maxFontUrlLength
  ) {
    throw new Error(`${label} 必须包含有效的 fontFamily 和 src。`)
  }

  let url: URL
  try {
    url = new URL(src)
  } catch {
    throw new Error(`${label}.src 必须是有效的 HTTPS 地址。`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label}.src 只支持不包含账号密码的 HTTPS 地址。`)
  }

  let fontWeight: PrintFontFace['fontWeight'] = 400
  if (value.fontWeight === 'normal') {
    fontWeight = 400
  } else if (value.fontWeight === 'bold') {
    fontWeight = 700
  } else if (value.fontWeight !== undefined) {
    const numericWeight = finite(value.fontWeight)
    if (numericWeight === null || numericWeight < 1 || numericWeight > 1000) {
      throw new Error(`${label}.fontWeight 必须是 normal、bold 或 1 到 1000。`)
    }
    fontWeight = numericWeight
  }

  let format = inferFontFormat(url)
  if (value.format !== undefined) {
    if (!fontFormats.has(value.format as PrintFontFormat)) {
      throw new Error(`${label}.format 只支持 woff2、woff、truetype 或 opentype。`)
    }
    format = value.format as PrintFontFormat
  }
  if (!format) throw new Error(`${label}.format 不能省略，除非字体链接带有支持的文件扩展名。`)

  return { fontFamily, src: url.toString(), fontWeight, format }
}

export function fontFileExtension(format: PrintFontFormat): string {
  return fontExtensions[format]
}

function cacheDirectory(): string {
  return join(app.getPath('userData'), 'fonts')
}

function cacheIdentity(font: PrintFontFace): { key: string; fileName: string; path: string } {
  const format = font.format as PrintFontFormat
  const key = createHash('sha256').update(`${font.src}\n${format}`).digest('hex')
  const fileName = `${key}.${fontFileExtension(format)}`
  return { key, fileName, path: join(cacheDirectory(), fileName) }
}

function withFontOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = fontOperations.get(key) ?? Promise.resolve()
  const result = previous.then(operation, operation)
  const tail = result.then(
    () => undefined,
    () => undefined
  )
  fontOperations.set(key, tail)
  return result.finally(() => {
    if (fontOperations.get(key) === tail) fontOperations.delete(key)
  })
}

function withCacheMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = cacheMutation.then(operation, operation)
  cacheMutation = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function blockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true
  }
  const [first, second, third] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

function proxySyntheticIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  return parts.length === 4 && parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)
}

function blockedIp(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (isIP(normalized) === 4) return blockedIpv4(normalized)
  if (isIP(normalized) !== 6) return true
  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length)
    return isIP(mappedIpv4) === 4 ? blockedIpv4(mappedIpv4) : true
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    /^f[cd]/.test(normalized) ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  )
}

async function assertPublicDestination(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('远程字体地址不能指向本机或私有网络。')
  }
  const literalType = isIP(hostname)
  const addresses = literalType ? [{ address: hostname }] : await lookup(hostname, { all: true })
  // Clash 等 TUN 模式会把公网域名解析到 198.18.0.0/15。只对域名解析结果放行；
  // 用户直接填写该保留网段的 IP 仍按私有目标拒绝。
  const blockedAddress = addresses.some(
    ({ address }) => blockedIp(address) && (literalType !== 0 || !proxySyntheticIpv4(address))
  )
  if (!addresses.length || blockedAddress) {
    throw new Error('远程字体地址不能指向本机、私有或保留网络。')
  }
}

function validateFontData(data: Buffer, format: PrintFontFormat): void {
  const signature = data.subarray(0, 4)
  const valid =
    (format === 'woff2' && signature.toString('ascii') === 'wOF2') ||
    (format === 'woff' && signature.toString('ascii') === 'wOFF') ||
    (format === 'opentype' && signature.toString('ascii') === 'OTTO') ||
    (format === 'truetype' &&
      (signature.equals(Buffer.from([0, 1, 0, 0])) || signature.toString('ascii') === 'true'))
  if (!valid) throw new Error(`远程文件不是有效的 ${format} 字体。`)
}

async function downloadFontWithSignal(font: PrintFontFace, signal: AbortSignal): Promise<Buffer> {
  let url = new URL(font.src)
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicDestination(url)
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal,
        headers: { Accept: 'font/woff2,font/woff,font/ttf,font/otf,application/octet-stream' }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('远程字体下载超过 20 秒。')
      }
      throw error
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location || redirectCount === maxRedirects) throw new Error('远程字体重定向次数过多。')
      url = new URL(location, url)
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('远程字体重定向只能使用不包含账号密码的 HTTPS 地址。')
      }
      continue
    }
    if (!response.ok) throw new Error(`远程字体下载失败：HTTP ${response.status}。`)
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > maxFontBytes) throw new Error('远程字体文件不能超过 30MB。')
    if (!response.body) throw new Error('远程字体响应没有文件内容。')

    const chunks: Buffer[] = []
    let received = 0
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxFontBytes) {
        await reader.cancel()
        throw new Error('远程字体文件不能超过 30MB。')
      }
      chunks.push(Buffer.from(value))
    }
    const data = Buffer.concat(chunks)
    validateFontData(data, font.format as PrintFontFormat)
    return data
  }
  throw new Error('远程字体下载失败。')
}

async function downloadFont(font: PrintFontFace): Promise<Buffer> {
  try {
    return await downloadFontWithSignal(font, AbortSignal.timeout(downloadTimeoutMs))
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('远程字体下载超过 20 秒。')
    }
    throw error
  }
}

async function readFontHeader(path: string): Promise<Buffer> {
  const file = await open(path, 'r')
  try {
    const header = Buffer.alloc(4)
    const { bytesRead } = await file.read(header, 0, header.length, 0)
    return header.subarray(0, bytesRead)
  } finally {
    await file.close()
  }
}

async function readCachedFont(font: PrintFontFace): Promise<CachedFont | null> {
  const identity = cacheIdentity(font)
  try {
    const info = await stat(identity.path)
    const header = await readFontHeader(identity.path)
    validateFontData(header, font.format as PrintFontFormat)
    return {
      ...identity,
      sizeBytes: info.size,
      version: Math.trunc(info.mtimeMs),
      source: 'cache'
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (error instanceof Error && error.message.startsWith('远程文件不是有效的')) {
      await rm(identity.path, { force: true })
      return null
    }
    throw error
  }
}

async function assertCacheCapacity(sizeBytes: number, replacingPath: string): Promise<void> {
  await mkdir(cacheDirectory(), { recursive: true })
  const entries = await readdir(cacheDirectory(), { withFileTypes: true })
  let totalBytes = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = join(cacheDirectory(), entry.name)
    if (filePath !== replacingPath) totalBytes += (await stat(filePath)).size
  }
  if (totalBytes + sizeBytes > maxCacheBytes) {
    throw new Error('字体缓存总容量不能超过 200MB，请先清除不再使用的字体缓存。')
  }
}

async function replaceCacheFile(path: string, data: Buffer): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  const backupPath = `${path}.${process.pid}.${randomUUID()}.bak`
  await writeFile(temporaryPath, data, { flag: 'wx' })
  let hasBackup = false
  try {
    try {
      await rename(path, backupPath)
      hasBackup = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    if (hasBackup) await rename(backupPath, path)
    throw error
  }
  if (hasBackup) await rm(backupPath, { force: true })
}

async function downloadAndCacheFont(font: PrintFontFace): Promise<CachedFont> {
  const identity = cacheIdentity(font)
  const data = await downloadFont(font)
  return withCacheMutation(async () => {
    await assertCacheCapacity(data.byteLength, identity.path)
    await replaceCacheFile(identity.path, data)
    const info = await stat(identity.path)
    return {
      ...identity,
      sizeBytes: info.size,
      version: Math.trunc(info.mtimeMs),
      source: 'download'
    }
  })
}

async function ensureCachedFontUnlocked(
  font: PrintFontFace,
  options: { refresh?: boolean } = {}
): Promise<CachedFont> {
  await mkdir(cacheDirectory(), { recursive: true })
  if (!options.refresh) {
    const cached = await readCachedFont(font)
    if (cached) return cached
  }

  return downloadAndCacheFont(font)
}

export async function ensureCachedFont(
  font: PrintFontFace,
  options: { refresh?: boolean } = {}
): Promise<CachedFont> {
  if (cacheClearOperation) await cacheClearOperation
  const { key } = cacheIdentity(font)
  return withFontOperation(key, () => ensureCachedFontUnlocked(font, options))
}

export async function copyCachedFont(
  font: PrintFontFace,
  destination: string
): Promise<CachedFont> {
  if (cacheClearOperation) await cacheClearOperation
  const { key } = cacheIdentity(font)
  return withFontOperation(key, async () => {
    const cached = await ensureCachedFontUnlocked(font)
    await copyFile(cached.path, destination)
    return cached
  })
}

export async function removeCachedFont(font: PrintFontFace): Promise<boolean> {
  if (cacheClearOperation) await cacheClearOperation
  const { key, path } = cacheIdentity(font)
  return withFontOperation(key, () =>
    withCacheMutation(async () => {
      try {
        await rm(path)
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      }
    })
  )
}

export async function clearCachedFonts(): Promise<number> {
  if (cacheClearOperation) {
    await cacheClearOperation
    return clearCachedFonts()
  }
  let finishClear: () => void = () => undefined
  cacheClearOperation = new Promise<void>((resolve) => {
    finishClear = resolve
  })
  try {
    await Promise.all(Array.from(fontOperations.values()))
    await mkdir(cacheDirectory(), { recursive: true })
    return await withCacheMutation(async () => {
      const entries = await readdir(cacheDirectory(), { withFileTypes: true })
      let removed = 0
      for (const entry of entries) {
        if (
          !entry.isFile() ||
          !/^[a-f0-9]{64}\.(?:woff2|woff|ttf|otf)(?:\..+\.(?:tmp|bak))?$/.test(entry.name)
        ) {
          continue
        }
        await rm(join(cacheDirectory(), entry.name), { force: true })
        removed += 1
      }
      return removed
    })
  } finally {
    cacheClearOperation = null
    finishClear()
  }
}

export async function getCachedFontFile(fileName: string): Promise<{
  content: Buffer
  sizeBytes: number
  format: PrintFontFormat
}> {
  const match = fileName.match(cacheFilePattern)
  if (!match) throw new Error('字体缓存文件不存在。')
  if (cacheClearOperation) await cacheClearOperation
  const key = match[1]
  return withFontOperation(key, async () => {
    const format = extensionFormats[match[2]]
    const path = join(cacheDirectory(), fileName)
    const info = await stat(path)
    const file = await open(path, 'r')
    try {
      const content = await file.readFile()
      validateFontData(content, format)
      return { content, sizeBytes: info.size, format }
    } finally {
      await file.close()
    }
  })
}
