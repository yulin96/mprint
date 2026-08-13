import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import type {
  PrintElement,
  PrintFontFace,
  PrintImageItem,
  PrintMargin,
  PrintPagePreset,
  PrintPageSize,
  PrintRequest,
  PrintResult,
  PrintTextItem
} from '../shared/print-types'
import { copyCachedFont, fontFileExtension, normalizeFontFace } from './font-cache'
import { normalizePrintElements, normalizePrintImage } from './print-elements'

const pageSizes: Record<PrintPagePreset, { widthMm: number; heightMm: number }> = {
  A3: { widthMm: 297, heightMm: 420 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
  Legal: { widthMm: 215.9, heightMm: 355.6 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
  Tabloid: { widthMm: 279.4, heightMm: 431.8 },
  'photo-5in': { widthMm: 89, heightMm: 127 },
  'photo-6in': { widthMm: 102, heightMm: 152 }
}

const dataImagePattern = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/=\s]+)$/
const imageLoadTimeoutMs = 30000
const fontLoadTimeoutMs = 15000
const printResultTimeoutMs = 15000
const maxFonts = 10
const maxCopies = 5

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizePage(value: unknown): PrintPageSize {
  if (typeof value === 'string' && value in pageSizes) return value as PrintPagePreset
  if (!isRecord(value)) throw new Error('page 必须是支持的纸张名称或毫米尺寸。')

  const widthMm = finite(value.widthMm)
  const heightMm = finite(value.heightMm)
  if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0 || widthMm > 1200 || heightMm > 1200) {
    throw new Error('自定义纸张 widthMm 和 heightMm 必须在 0 到 1200 之间。')
  }
  return { widthMm, heightMm }
}

function normalizeMargin(value: unknown): Required<Exclude<PrintMargin, number>> {
  if (value === undefined) return { topMm: 0, rightMm: 0, bottomMm: 0, leftMm: 0 }
  const uniform = finite(value)
  if (uniform !== null)
    return { topMm: uniform, rightMm: uniform, bottomMm: uniform, leftMm: uniform }
  if (!isRecord(value)) throw new Error('margin 参数不正确。')
  return {
    topMm: finite(value.topMm) ?? 0,
    rightMm: finite(value.rightMm) ?? 0,
    bottomMm: finite(value.bottomMm) ?? 0,
    leftMm: finite(value.leftMm) ?? 0
  }
}

export function normalizePrintRequest(value: unknown): PrintRequest {
  if (!isRecord(value)) throw new Error('打印参数必须是 JSON 对象。')
  const fonts = Array.isArray(value.fonts) ? value.fonts : []
  if (fonts.length > maxFonts) throw new Error(`fonts 最多 ${maxFonts} 项。`)
  const printer = isRecord(value.printer) ? value.printer : {}
  const copies = finite(printer.copies)
  const offset = isRecord(value.offset) ? value.offset : {}
  const normalizedFonts = fonts.map((item, index) => normalizeFontFace(item, `fonts[${index}]`))
  const fontKeys = new Set<string>()
  normalizedFonts.forEach((font, index) => {
    const key = `${font.fontFamily}\u0000${font.fontWeight}`
    if (fontKeys.has(key)) {
      throw new Error(`fonts[${index}] 与已有字体的 fontFamily 和 fontWeight 重复。`)
    }
    fontKeys.add(key)
  })

  return {
    page: normalizePage(value.page),
    landscape: value.landscape === true,
    margin: normalizeMargin(value.margin),
    offset: { xMm: finite(offset.xMm) ?? 0, yMm: finite(offset.yMm) ?? 0 },
    fonts: normalizedFonts,
    background:
      value.background === undefined
        ? undefined
        : normalizePrintImage(value.background, 'background'),
    elements: normalizePrintElements(value),
    printer: {
      silent: printer.silent !== false,
      deviceName:
        typeof printer.deviceName === 'string' && printer.deviceName.trim()
          ? printer.deviceName.trim()
          : undefined,
      copies: copies && Number.isInteger(copies) ? Math.min(maxCopies, Math.max(1, copies)) : 1,
      useDefaultPageSize: printer.useDefaultPageSize === true
    }
  }
}

function dimensions(page: PrintPageSize, landscape = false): { widthMm: number; heightMm: number } {
  const value = typeof page === 'string' ? pageSizes[page] : page
  return landscape ? { widthMm: value.heightMm, heightMm: value.widthMm } : value
}

function pageSize(page: PrintPageSize): Electron.WebContentsPrintOptions['pageSize'] {
  if (
    page === 'A3' ||
    page === 'A4' ||
    page === 'A5' ||
    page === 'A6' ||
    page === 'Legal' ||
    page === 'Letter' ||
    page === 'Tabloid'
  ) {
    return page
  }
  const value = typeof page === 'string' ? pageSizes[page] : page
  return { width: Math.round(value.widthMm * 1000), height: Math.round(value.heightMm * 1000) }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\3c ')
    .replace(/[\r\n]/g, ' ')
}

function renderFontFace(font: PrintFontFace): string {
  const format = font.format ? ` format('${font.format}')` : ''
  return `@font-face{font-family:'${escapeCssString(font.fontFamily)}';src:url('${escapeCssString(font.src)}')${format};font-weight:${font.fontWeight ?? 400};font-style:normal;font-display:block}`
}

function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function fontLoadRequests(request: PrintRequest): Array<{
  family: string
  descriptor: string
  sample: string
}> {
  const texts = (request.elements ?? []).filter(
    (element): element is Extract<PrintElement, { type: 'text' }> => element.type === 'text'
  )
  return (request.fonts ?? []).map((font) => {
    const sample = texts
      .filter((text) => text.fontFamily === font.fontFamily)
      .map((text) => text.content)
      .join('')
      .slice(0, 512)
    return {
      family: font.fontFamily,
      descriptor: `${font.fontWeight ?? 400} 12px '${escapeCssString(font.fontFamily)}'`,
      sample: sample || 'mprint 字体加载验证'
    }
  })
}

function imageExtension(mime: string): string {
  return mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
}

async function prepareImages(request: PrintRequest, directory: string): Promise<PrintRequest> {
  const prepare = async (item: PrintImageItem): Promise<PrintImageItem> => {
    const match = item.src.match(dataImagePattern)
    if (!match) return item
    const filePath = join(directory, `${randomUUID()}.${imageExtension(match[1])}`)
    await writeFile(filePath, Buffer.from(match[2].replace(/\s/g, ''), 'base64'))
    return { ...item, src: pathToFileURL(filePath).toString() }
  }
  return {
    ...request,
    background: request.background ? await prepare(request.background) : undefined,
    elements: await Promise.all(
      (request.elements ?? []).map(async (element): Promise<PrintElement> =>
        element.type === 'image' ? { type: 'image', ...(await prepare(element)) } : element
      )
    )
  }
}

async function prepareFonts(request: PrintRequest, directory: string): Promise<PrintRequest> {
  const fonts = await Promise.all(
    (request.fonts ?? []).map(async (font, index) => {
      const filePath = join(directory, `font-${index}.${fontFileExtension(font.format!)}`)
      await copyCachedFont(font, filePath)
      return { ...font, src: pathToFileURL(filePath).toString() }
    })
  )
  return { ...request, fonts }
}

function renderImage(item: PrintImageItem, index: number): string {
  return `<img data-image="${index}" src="${escapeHtml(item.src)}" alt="" style="position:absolute;display:block;left:${item.xMm}mm;top:${item.yMm}mm;width:${item.widthMm}mm;height:${item.heightMm}mm;object-fit:${item.fit};object-position:center;transform:rotate(${item.rotate}deg);transform-origin:center">`
}

function renderText(item: PrintTextItem): string {
  const justifyContent =
    item.verticalAlign === 'middle'
      ? 'center'
      : item.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start'
  return `<div style="position:absolute;display:flex;flex-direction:column;justify-content:${justifyContent};box-sizing:border-box;overflow:hidden;left:${item.xMm}mm;top:${item.yMm}mm;width:${item.widthMm}mm;height:${item.heightMm}mm;font:${item.fontWeight} ${item.fontSizePt}pt/${item.lineHeight} '${escapeHtml(escapeCssString(item.fontFamily ?? 'Microsoft YaHei'))}';color:${item.color};transform:rotate(${item.rotate}deg);transform-origin:center"><div style="width:100%;white-space:pre-wrap;overflow-wrap:anywhere;text-align:${item.align}">${escapeHtml(item.content)}</div></div>`
}

function renderHtml(request: PrintRequest, preview: boolean): string {
  const size = dimensions(request.page, request.landscape)
  const margin = request.margin as Required<Exclude<PrintMargin, number>>
  const offset = request.offset ?? {}
  let imageIndex = 0
  const background = request.background ? renderImage(request.background, imageIndex++) : ''
  const elements = (request.elements ?? [])
    .map((element) =>
      element.type === 'image' ? renderImage(element, imageIndex++) : renderText(element)
    )
    .join('')
  const cssPage = `${size.widthMm}mm ${size.heightMm}mm`
  const fontLoads = inlineJson(fontLoadRequests(request))
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${(request.fonts ?? []).map(renderFontFace).join('\n')}
@page{${request.printer?.useDefaultPageSize ? '' : `size:${cssPage};`}margin:${margin.topMm}mm ${margin.rightMm}mm ${margin.bottomMm}mm ${margin.leftMm}mm}
html,body{margin:0;padding:0}html{background:${preview ? '#e9e5dc' : '#fff'}}body{position:relative;width:${size.widthMm}mm;height:${size.heightMm}mm;margin:${preview ? '24px auto' : '0'};overflow:hidden;background:#fff;${preview ? 'box-shadow:0 16px 48px rgba(36,31,25,.18)' : ''};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div style="position:absolute;left:${offset.xMm ?? 0}mm;top:${offset.yMm ?? 0}mm;width:100%;height:100%">
${background}${elements}</div><script>
function loadImage(image){return new Promise(resolve=>{let done=false;const finish=(success,reason='')=>{if(done)return;done=true;clearTimeout(timer);resolve({index:Number(image.dataset.image),success,reason})};const timer=setTimeout(()=>finish(false,'图片加载超时'),${imageLoadTimeoutMs});const loaded=async()=>{try{if(typeof image.decode==='function')await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('图片没有有效尺寸');finish(true)}catch(error){finish(false,error instanceof Error?error.message:String(error))}};if(image.complete){void loaded()}else{image.addEventListener('load',()=>void loaded(),{once:true});image.addEventListener('error',()=>finish(false,'图片加载失败'),{once:true})}})}
const fontLoads=${fontLoads};
async function loadFont(item){if(!document.fonts)throw new Error('当前打印环境不支持加载声明字体。');const faces=await Promise.race([document.fonts.load(item.descriptor,item.sample),new Promise((_,reject)=>setTimeout(()=>reject(new Error('字体加载超时：'+item.family)),${fontLoadTimeoutMs}))]);if(!faces.length)throw new Error('字体加载失败：'+item.family)}
window.__mprintReady=(async()=>{const result=await Promise.all(Array.from(document.querySelectorAll('img[data-image]')).map(loadImage));await Promise.all(fontLoads.map(loadFont));if(document.fonts)await document.fonts.ready;return result})()
</script></body></html>`
}

async function waitUntilReady(window: BrowserWindow): Promise<void> {
  const results = (await window.webContents.executeJavaScript('window.__mprintReady')) as Array<{
    index: number
    success: boolean
    reason: string
  }>
  const failed = results.filter((item) => !item.success)
  if (failed.length)
    throw new Error(failed.map((item) => `图片 ${item.index + 1}：${item.reason}`).join('；'))
}

function submit(window: BrowserWindow, request: PrintRequest): Promise<PrintResult> {
  return new Promise((resolve) => {
    const options: Electron.WebContentsPrintOptions = {
      silent: request.printer?.silent ?? true,
      printBackground: true,
      landscape: request.landscape ?? false,
      copies: request.printer?.copies ?? 1,
      margins: { marginType: 'none' }
    }
    if (!request.printer?.useDefaultPageSize) options.pageSize = pageSize(request.page)
    if (request.printer?.deviceName) options.deviceName = request.printer.deviceName

    const timer = setTimeout(
      () => resolve({ success: false, failureReason: '打印机 15 秒内没有返回结果。' }),
      printResultTimeoutMs
    )
    window.webContents.print(options, (success, failureReason) => {
      clearTimeout(timer)
      resolve({ success, failureReason: success ? undefined : failureReason })
    })
  })
}

export async function runPrint(value: unknown): Promise<PrintResult> {
  const directory = await mkdtemp(join(tmpdir(), 'mprint-'))
  let window: BrowserWindow | null = null
  try {
    const normalized = normalizePrintRequest(value)
    const request = await prepareImages(await prepareFonts(normalized, directory), directory)
    const htmlPath = join(directory, 'print.html')
    await writeFile(htmlPath, renderHtml(request, false), 'utf8')
    window = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })
    await window.loadFile(htmlPath)
    await waitUntilReady(window)
    return await submit(window, request)
  } finally {
    if (window && !window.isDestroyed()) window.close()
    await rm(directory, { recursive: true, force: true })
  }
}

export async function openPrintPreview(value: unknown): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'mprint-preview-'))
  let window: BrowserWindow | null = null
  let cleanupOnClose = false
  try {
    const normalized = normalizePrintRequest(value)
    const request = await prepareImages(await prepareFonts(normalized, directory), directory)
    const size = dimensions(request.page, request.landscape)
    const htmlPath = join(directory, 'preview.html')
    await writeFile(htmlPath, renderHtml(request, true), 'utf8')
    window = new BrowserWindow({
      title: 'mprint 打印预览',
      width: Math.min(1200, Math.max(560, Math.round(size.widthMm * 4) + 96)),
      height: Math.min(1000, Math.max(600, Math.round(size.heightMm * 4) + 96)),
      autoHideMenuBar: true,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })
    await window.loadFile(htmlPath)
    await waitUntilReady(window)
    window.once('closed', () => void rm(directory, { recursive: true, force: true }))
    cleanupOnClose = true
  } finally {
    if (!cleanupOnClose) {
      if (window && !window.isDestroyed()) window.close()
      await rm(directory, { recursive: true, force: true })
    }
  }
}
