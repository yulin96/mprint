import { app } from 'electron'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

type EditorTemplateData = {
  version: 1
  page: { widthMm: number; heightMm: number }
  landscape: boolean
  useDefaultPageSize: boolean
  fonts: unknown[]
  items: unknown[]
}

export type EditorTemplateRecord = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  data: EditorTemplateData
  versions: Array<{
    id: string
    createdAt: string
    data: EditorTemplateData
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, label: string): number {
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error(`${label}必须是有效数字。`)
  return result
}

function stringValue(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label}无效。`)
  return value
}

function normalizeGeometry(value: Record<string, unknown>, label: string): Record<string, number> {
  const xMm = finite(value.xMm, `${label} X`)
  const yMm = finite(value.yMm, `${label} Y`)
  const widthMm = finite(value.widthMm, `${label}宽度`)
  const heightMm = finite(value.heightMm, `${label}高度`)
  const rotate = finite(value.rotate ?? 0, `${label}旋转`)
  if (xMm < 0 || yMm < 0 || widthMm <= 0 || heightMm <= 0 || widthMm > 1200 || heightMm > 1200) {
    throw new Error(`${label}的位置或尺寸无效。`)
  }
  if (![0, 90, 180, 270].includes(rotate)) throw new Error(`${label}的旋转角度无效。`)
  return { xMm, yMm, widthMm, heightMm, rotate }
}

function normalizeItem(value: unknown, index: number): Record<string, unknown> {
  const label = `元素 ${index + 1}`
  if (!isRecord(value)) throw new Error(`${label}格式无效。`)
  const id = stringValue(value.id, `${label} ID`, 100)
  const geometry = normalizeGeometry(value, label)
  if (value.type === 'image') {
    if ('src' in value) throw new Error('模板中的图片只能保存占位框，不能包含真实图片数据。')
    return {
      id,
      type: 'image',
      name: stringValue(value.name, `${label}名称`, 200),
      ...geometry
    }
  }
  if (value.type !== 'text') throw new Error(`${label}类型无效。`)
  const fontSizePt = finite(value.fontSizePt ?? 12, `${label}字号`)
  const fontWeight = finite(value.fontWeight ?? 400, `${label}字重`)
  const lineHeight = finite(value.lineHeight ?? 1.2, `${label}行高`)
  if (fontSizePt <= 0 || fontSizePt > 500 || lineHeight <= 0 || lineHeight > 20) {
    throw new Error(`${label}的文字参数无效。`)
  }
  const align = value.align ?? 'center'
  const verticalAlign = value.verticalAlign ?? 'middle'
  if (!['left', 'center', 'right'].includes(String(align)))
    throw new Error(`${label}水平对齐无效。`)
  if (!['top', 'middle', 'bottom'].includes(String(verticalAlign))) {
    throw new Error(`${label}垂直对齐无效。`)
  }
  return {
    id,
    type: 'text',
    content: stringValue(value.content, `${label}文字`, 10000),
    ...geometry,
    fontSizePt,
    fontFamily: stringValue(value.fontFamily ?? 'Microsoft YaHei', `${label}字体`, 200),
    fontWeight,
    color: stringValue(value.color ?? '#000000', `${label}颜色`, 50),
    align,
    verticalAlign,
    lineHeight
  }
}

function normalizeFont(value: unknown, index: number): Record<string, unknown> {
  const label = `远程字体 ${index + 1}`
  if (!isRecord(value)) throw new Error(`${label}格式无效。`)
  const fontWeight = finite(value.fontWeight ?? 400, `${label}字重`)
  const format = String(value.format ?? 'woff2')
  if (!['woff2', 'woff', 'truetype', 'opentype'].includes(format))
    throw new Error(`${label}格式无效。`)
  return {
    id: stringValue(value.id, `${label} ID`, 100),
    fontFamily: stringValue(value.fontFamily, `${label}名称`, 200),
    src: stringValue(value.src, `${label}链接`, 4096),
    fontWeight,
    format
  }
}

function normalizeData(value: unknown): EditorTemplateData {
  if (!isRecord(value) || !isRecord(value.page)) throw new Error('模板数据格式无效。')
  const widthMm = finite(value.page.widthMm, '纸张宽度')
  const heightMm = finite(value.page.heightMm, '纸张高度')
  if (widthMm <= 0 || heightMm <= 0 || widthMm > 1200 || heightMm > 1200) {
    throw new Error('纸张宽高必须在 0 到 1200 mm 之间。')
  }
  if (!Array.isArray(value.fonts) || value.fonts.length > 10) throw new Error('远程字体数据无效。')
  if (!Array.isArray(value.items) || value.items.length > 200) throw new Error('模板元素数据无效。')
  const fonts = value.fonts.map(normalizeFont)
  const items = value.items.map(normalizeItem)
  const serialized = JSON.stringify(value)
  if (Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024)
    throw new Error('模板数据不能超过 2MB。')
  return {
    version: 1,
    page: { widthMm, heightMm },
    landscape: value.landscape === true,
    useDefaultPageSize: value.useDefaultPageSize === true,
    fonts,
    items
  }
}

function templatesDirectory(): string {
  return join(app.getPath('userData'), 'templates')
}

function recordsDirectory(): string {
  return join(templatesDirectory(), 'records')
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

function normalizeVersions(
  value: unknown,
  fallbackData: EditorTemplateData,
  fallbackCreatedAt: string
): EditorTemplateRecord['versions'] {
  if (!Array.isArray(value)) {
    return [{ id: randomUUID(), createdAt: fallbackCreatedAt, data: fallbackData }]
  }
  if (!value.length || value.length > 20) throw new Error('模板历史版本数据无效。')
  return value.map((version, index) => {
    if (!isRecord(version)) throw new Error(`历史版本 ${index + 1}格式无效。`)
    const id = typeof version.id === 'string' ? version.id : ''
    const createdAt = typeof version.createdAt === 'string' ? version.createdAt : ''
    if (!/^[a-f0-9-]+$/.test(id) || !Number.isFinite(Date.parse(createdAt))) {
      throw new Error(`历史版本 ${index + 1}元数据无效。`)
    }
    return { id, createdAt, data: normalizeData(version.data) }
  })
}

export async function readTemplateLibrary(): Promise<{
  draft: EditorTemplateData | null
  templates: EditorTemplateRecord[]
}> {
  let draft: EditorTemplateData | null = null
  try {
    draft = normalizeData(await readJson(join(templatesDirectory(), 'draft.json')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const templates: EditorTemplateRecord[] = []
  try {
    const files = await readdir(recordsDirectory())
    for (const file of files.filter((name) => /^[a-f0-9-]+\.json$/.test(name))) {
      try {
        const value = await readJson(join(recordsDirectory(), file))
        if (!isRecord(value)) throw new Error('记录内容不是 JSON 对象。')
        const id = typeof value.id === 'string' ? value.id : ''
        const name = typeof value.name === 'string' ? value.name : ''
        const createdAt = typeof value.createdAt === 'string' ? value.createdAt : ''
        const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
        if (
          !/^[a-f0-9-]+$/.test(id) ||
          !name ||
          name.length > 80 ||
          !Number.isFinite(Date.parse(createdAt)) ||
          !Number.isFinite(Date.parse(updatedAt))
        ) {
          throw new Error('记录元数据无效。')
        }
        const data = normalizeData(value.data)
        templates.push({
          id,
          name,
          createdAt,
          updatedAt,
          data,
          versions: normalizeVersions(value.versions, data, updatedAt)
        })
      } catch (error) {
        throw new Error(
          `模板记录 ${file} 无法读取：${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  templates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return { draft, templates }
}

export async function saveDraft(value: unknown): Promise<{ success: true; savedAt: string }> {
  const data = normalizeData(value)
  const savedAt = new Date().toISOString()
  await writeJson(join(templatesDirectory(), 'draft.json'), data)
  return { success: true, savedAt }
}

export async function saveTemplate(value: unknown): Promise<EditorTemplateRecord> {
  if (!isRecord(value)) throw new Error('保存模板参数无效。')
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name || name.length > 80) throw new Error('模板名称必须为 1 到 80 个字符。')
  const data = normalizeData(value.data)
  const requestedId = typeof value.id === 'string' ? value.id : ''
  const id = requestedId || randomUUID()
  if (!/^[a-f0-9-]+$/.test(id)) throw new Error('模板 ID 无效。')
  const path = join(recordsDirectory(), `${id}.json`)
  let createdAt = new Date().toISOString()
  let versions: EditorTemplateRecord['versions'] = []
  if (requestedId) {
    try {
      const existing = await readJson(path)
      if (isRecord(existing) && typeof existing.createdAt === 'string') {
        createdAt = existing.createdAt
        const existingData = normalizeData(existing.data)
        const existingUpdatedAt =
          typeof existing.updatedAt === 'string' ? existing.updatedAt : createdAt
        versions = normalizeVersions(existing.versions, existingData, existingUpdatedAt)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('要更新的模板不存在。')
      }
      throw error
    }
  }
  const updatedAt = new Date().toISOString()
  versions.push({ id: randomUUID(), createdAt: updatedAt, data })
  versions = versions.slice(-20)
  const record = { id, name, createdAt, updatedAt, data, versions }
  await writeJson(path, record)
  return record
}

export async function deleteTemplate(value: unknown): Promise<{ success: true }> {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-f0-9-]+$/.test(value.id)) {
    throw new Error('模板 ID 无效。')
  }
  try {
    await rm(join(recordsDirectory(), `${value.id}.json`))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('要删除的模板不存在。')
    throw error
  }
  return { success: true }
}
