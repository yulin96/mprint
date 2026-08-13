import type {
  PrintElement,
  PrintImageFit,
  PrintImageItem,
  PrintTextItem
} from '../shared/print-types'

const dataImagePattern = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/=\s]+)$/
const rotations = new Set([0, 90, 180, 270])
const imageFits = new Set<PrintImageFit>(['fill', 'contain', 'cover'])
const maxImages = 20
const maxTexts = 200
const maxDataImageBytes = 20 * 1024 * 1024
const maxElementSizeMm = 1200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizePrintImage(value: unknown, label: string): PrintImageItem {
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
    widthMm === null ||
    heightMm === null ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    throw new Error(`${label} 必须包含有效的 src、xMm、yMm、widthMm 和 heightMm。`)
  }
  if (widthMm > maxElementSizeMm || heightMm > maxElementSizeMm) {
    throw new Error(`${label}.widthMm 和 heightMm 不能超过 ${maxElementSizeMm}。`)
  }
  if (!dataImagePattern.test(src)) {
    throw new Error(`${label} 首版只支持 PNG、JPEG 或 WebP Data URL。`)
  }
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

export function normalizePrintText(value: unknown, label: string): PrintTextItem {
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
  const verticalAlign =
    value.verticalAlign === 'middle' || value.verticalAlign === 'bottom'
      ? value.verticalAlign
      : 'top'
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
    verticalAlign,
    lineHeight: Math.max(0.5, finite(value.lineHeight) ?? 1.2),
    rotate: rotations.has(rotation) ? (rotation as 0 | 90 | 180 | 270) : 0
  }
}

function normalizeElement(value: unknown, label: string): PrintElement {
  if (!isRecord(value)) throw new Error(`${label} 参数不正确。`)
  if (value.type === 'image') return { type: 'image', ...normalizePrintImage(value, label) }
  if (value.type === 'text') return { type: 'text', ...normalizePrintText(value, label) }
  throw new Error(`${label}.type 只支持 image 或 text。`)
}

function assertElementLimits(elements: PrintElement[]): void {
  const imageCount = elements.filter((element) => element.type === 'image').length
  const textCount = elements.length - imageCount
  if (imageCount > maxImages) throw new Error(`图片元素最多 ${maxImages} 项。`)
  if (textCount > maxTexts) throw new Error(`文字元素最多 ${maxTexts} 项。`)
}

export function normalizePrintElements(value: Record<string, unknown>): PrintElement[] {
  const usesElements = value.elements !== undefined
  const usesLegacy = value.images !== undefined || value.texts !== undefined
  if (usesElements && usesLegacy) {
    throw new Error('elements 不能与 images 或 texts 同时使用。')
  }

  if (usesElements) {
    if (!Array.isArray(value.elements)) throw new Error('elements 必须是数组。')
    const elements = value.elements.map((item, index) =>
      normalizeElement(item, `elements[${index}]`)
    )
    assertElementLimits(elements)
    return elements
  }

  if (value.images !== undefined && !Array.isArray(value.images))
    throw new Error('images 必须是数组。')
  if (value.texts !== undefined && !Array.isArray(value.texts))
    throw new Error('texts 必须是数组。')
  const images = (value.images ?? []) as unknown[]
  const texts = (value.texts ?? []) as unknown[]
  const elements: PrintElement[] = [
    ...images.map((item, index) => ({
      type: 'image' as const,
      ...normalizePrintImage(item, `images[${index}]`)
    })),
    ...texts.map((item, index) => ({
      type: 'text' as const,
      ...normalizePrintText(item, `texts[${index}]`)
    }))
  ]
  assertElementLimits(elements)
  return elements
}
