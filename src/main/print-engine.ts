import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import type {
  PrintImageFit,
  PrintImageItem,
  PrintMargin,
  PrintPagePreset,
  PrintPageSize,
  PrintRequest,
  PrintResult,
  PrintTextItem
} from '../shared/print-types'

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
const rotations = new Set([0, 90, 180, 270])
const imageFits = new Set<PrintImageFit>(['fill', 'contain', 'cover'])
const imageLoadTimeoutMs = 30000
const printResultTimeoutMs = 15000
const maxImages = 20
const maxTexts = 200
const maxCopies = 5
const maxDataImageBytes = 20 * 1024 * 1024

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

function normalizeImage(value: unknown, label: string): PrintImageItem {
  if (!isRecord(value)) throw new Error(`${label} 参数不正确。`)
  const src = typeof value.src === 'string' ? value.src.trim() : ''
  const xMm = finite(value.xMm)
  const yMm = finite(value.yMm)
  const widthMm = finite(value.widthMm)
  const heightMm = finite(value.heightMm)
  if (
    !src ||
    xMm === null ||
    yMm === null ||
    !widthMm ||
    !heightMm ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    throw new Error(`${label} 必须包含有效的 src、xMm、yMm、widthMm 和 heightMm。`)
  }
  if (!dataImagePattern.test(src))
    throw new Error(`${label} 首版只支持 PNG、JPEG 或 WebP Data URL。`)
  if (Buffer.byteLength(src, 'utf8') > maxDataImageBytes) throw new Error(`${label} 超过 20MB。`)
  const rotation = finite(value.rotate) ?? 0
  return {
    src,
    xMm,
    yMm,
    widthMm,
    heightMm,
    fit: imageFits.has(value.fit as PrintImageFit) ? (value.fit as PrintImageFit) : 'fill',
    rotate: rotations.has(rotation) ? (rotation as 0 | 90 | 180 | 270) : 0
  }
}

function normalizeText(value: unknown, label: string): PrintTextItem {
  if (!isRecord(value)) throw new Error(`${label} 参数不正确。`)
  const xMm = finite(value.xMm)
  const yMm = finite(value.yMm)
  const widthMm = finite(value.widthMm)
  const heightMm = finite(value.heightMm)
  if (typeof value.content !== 'string' || xMm === null || yMm === null || !widthMm || !heightMm) {
    throw new Error(`${label} 必须包含 content、xMm、yMm、widthMm 和 heightMm。`)
  }
  const rotation = finite(value.rotate) ?? 0
  const align = value.align === 'center' || value.align === 'right' ? value.align : 'left'
  return {
    content: value.content,
    xMm,
    yMm,
    widthMm,
    heightMm,
    fontSizePt: Math.min(200, Math.max(1, finite(value.fontSizePt) ?? 12)),
    fontFamily:
      typeof value.fontFamily === 'string' && value.fontFamily.trim()
        ? value.fontFamily.trim()
        : 'Microsoft YaHei',
    fontWeight:
      value.fontWeight === 'bold' || value.fontWeight === 'normal'
        ? value.fontWeight
        : (finite(value.fontWeight) ?? 400),
    color:
      typeof value.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.color)
        ? value.color
        : '#000000',
    align,
    lineHeight: Math.max(0.5, finite(value.lineHeight) ?? 1.2),
    rotate: rotations.has(rotation) ? (rotation as 0 | 90 | 180 | 270) : 0
  }
}

export function normalizePrintRequest(value: unknown): PrintRequest {
  if (!isRecord(value)) throw new Error('打印参数必须是 JSON 对象。')
  const images = Array.isArray(value.images) ? value.images : []
  const texts = Array.isArray(value.texts) ? value.texts : []
  if (images.length > maxImages) throw new Error(`images 最多 ${maxImages} 项。`)
  if (texts.length > maxTexts) throw new Error(`texts 最多 ${maxTexts} 项。`)
  const printer = isRecord(value.printer) ? value.printer : {}
  const copies = finite(printer.copies)
  const offset = isRecord(value.offset) ? value.offset : {}

  return {
    page: normalizePage(value.page),
    landscape: value.landscape === true,
    margin: normalizeMargin(value.margin),
    offset: { xMm: finite(offset.xMm) ?? 0, yMm: finite(offset.yMm) ?? 0 },
    background:
      value.background === undefined ? undefined : normalizeImage(value.background, 'background'),
    images: images.map((item, index) => normalizeImage(item, `images[${index}]`)),
    texts: texts.map((item, index) => normalizeText(item, `texts[${index}]`)),
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
    images: await Promise.all((request.images ?? []).map(prepare))
  }
}

function renderImage(item: PrintImageItem, index: number): string {
  const ratio = 300 / 25.4
  return `<canvas data-image="${index}" data-src="${escapeHtml(item.src)}" data-fit="${item.fit}" data-rotate="${item.rotate}" width="${Math.round(item.widthMm * ratio)}" height="${Math.round(item.heightMm * ratio)}" style="position:absolute;left:${item.xMm}mm;top:${item.yMm}mm;width:${item.widthMm}mm;height:${item.heightMm}mm"></canvas>`
}

function renderText(item: PrintTextItem): string {
  return `<div style="position:absolute;box-sizing:border-box;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;left:${item.xMm}mm;top:${item.yMm}mm;width:${item.widthMm}mm;height:${item.heightMm}mm;font:${item.fontWeight} ${item.fontSizePt}pt/${item.lineHeight} '${escapeHtml(item.fontFamily ?? 'Microsoft YaHei')}';color:${item.color};text-align:${item.align};transform:rotate(${item.rotate}deg);transform-origin:center">${escapeHtml(item.content)}</div>`
}

function renderHtml(request: PrintRequest, preview: boolean): string {
  const size = dimensions(request.page, request.landscape)
  const margin = request.margin as Required<Exclude<PrintMargin, number>>
  const offset = request.offset ?? {}
  const images = [request.background, ...(request.images ?? [])].filter(Boolean) as PrintImageItem[]
  const cssPage = `${size.widthMm}mm ${size.heightMm}mm`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{${request.printer?.useDefaultPageSize ? '' : `size:${cssPage};`}margin:${margin.topMm}mm ${margin.rightMm}mm ${margin.bottomMm}mm ${margin.leftMm}mm}
html,body{margin:0;padding:0}html{background:${preview ? '#e9e5dc' : '#fff'}}body{position:relative;width:${size.widthMm}mm;height:${size.heightMm}mm;margin:${preview ? '24px auto' : '0'};overflow:hidden;background:#fff;${preview ? 'box-shadow:0 16px 48px rgba(36,31,25,.18)' : ''};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div style="position:absolute;left:${offset.xMm ?? 0}mm;top:${offset.yMm ?? 0}mm;width:100%;height:100%">
${images.map(renderImage).join('')}${(request.texts ?? []).map(renderText).join('')}</div><script>
function draw(canvas){return new Promise(resolve=>{const image=new Image();let done=false;const finish=(success,reason='')=>{if(done)return;done=true;clearTimeout(timer);resolve({index:Number(canvas.dataset.image),success,reason})};const timer=setTimeout(()=>finish(false,'图片加载超时'),${imageLoadTimeoutMs});image.onload=()=>{try{const context=canvas.getContext('2d');if(!context)return finish(false,'无法创建画布');const width=canvas.width,height=canvas.height,fit=canvas.dataset.fit,rotate=Number(canvas.dataset.rotate),quarter=rotate===90||rotate===270;context.fillStyle='#fff';context.fillRect(0,0,width,height);let drawWidth=quarter?height:width,drawHeight=quarter?width:height;if(fit==='contain'||fit==='cover'){const scale=fit==='contain'?Math.min(width/(quarter?image.naturalHeight:image.naturalWidth),height/(quarter?image.naturalWidth:image.naturalHeight)):Math.max(width/(quarter?image.naturalHeight:image.naturalWidth),height/(quarter?image.naturalWidth:image.naturalHeight));drawWidth=image.naturalWidth*scale;drawHeight=image.naturalHeight*scale}context.save();context.translate(width/2,height/2);context.rotate(rotate*Math.PI/180);context.drawImage(image,-drawWidth/2,-drawHeight/2,drawWidth,drawHeight);context.restore();finish(true)}catch(error){finish(false,String(error))}};image.onerror=()=>finish(false,'图片加载失败');image.src=canvas.dataset.src})}
window.__mprintReady=Promise.all(Array.from(document.querySelectorAll('canvas')).map(draw)).then(async result=>{if(document.fonts)await document.fonts.ready;return result})
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
    const request = await prepareImages(normalizePrintRequest(value), directory)
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
    const request = await prepareImages(normalizePrintRequest(value), directory)
    const size = dimensions(request.page, request.landscape)
    const htmlPath = join(directory, 'preview.html')
    await writeFile(htmlPath, renderHtml(request, true), 'utf8')
    window = new BrowserWindow({
      title: 'mprint 打印预览',
      width: Math.min(1200, Math.max(560, Math.round(size.widthMm * 4) + 96)),
      height: Math.min(1000, Math.max(600, Math.round(size.heightMm * 4) + 96)),
      autoHideMenuBar: true,
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
