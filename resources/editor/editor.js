/* eslint-disable @typescript-eslint/explicit-function-return-type */

const presets = {
  card: { widthMm: 86, heightMm: 54 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
  'photo-6in': { widthMm: 102, heightMm: 152 }
}
const defaultTextAlign = 'center'
const defaultTextVerticalAlign = 'middle'

const fontFamilies = new Set(['Microsoft YaHei', 'SimSun', 'SimHei', 'Arial'])
let availableSystemFontCount = 0

const state = {
  page: { ...presets.card },
  landscape: false,
  useDefaultPageSize: false,
  fonts: [],
  selectedId: null,
  items: [
    {
      id: crypto.randomUUID(),
      type: 'text',
      content: 'mprint',
      xMm: 8,
      yMm: 8,
      widthMm: 70,
      heightMm: 12,
      fontSizePt: 20,
      fontFamily: 'Microsoft YaHei',
      fontWeight: 700,
      color: '#24211c',
      align: defaultTextAlign,
      verticalAlign: defaultTextVerticalAlign,
      lineHeight: 1.2,
      rotate: 0
    },
    {
      id: crypto.randomUUID(),
      type: 'text',
      content: '本地打印模板',
      xMm: 8,
      yMm: 25,
      widthMm: 70,
      heightMm: 8,
      fontSizePt: 10,
      fontFamily: 'Microsoft YaHei',
      fontWeight: 400,
      color: '#ff6248',
      align: defaultTextAlign,
      verticalAlign: defaultTextVerticalAlign,
      lineHeight: 1.2,
      rotate: 0
    }
  ]
}
state.selectedId = state.items[0].id

const byId = (id) => {
  const value = document.getElementById(id)
  if (!value) throw new Error(`页面缺少元素：${id}`)
  return value
}

const paper = byId('paper')
const stage = byId('stage')
const rulerX = byId('rulerX')
const rulerY = byId('rulerY')
const paperMeta = byId('paperMeta')
const paperSummary = byId('paperSummary')
const paperControl = byId('paperControl')
const paperSettingsButton = byId('paperSettingsButton')
const paperPopover = byId('paperPopover')
const canvasToolbar = byId('canvasToolbar')
const textAlignToolbar = byId('textAlignToolbar')
const textAlignButtons = Array.from(document.querySelectorAll('[data-text-align]'))
const verticalAlignButtons = Array.from(document.querySelectorAll('[data-vertical-align]'))
const elementList = byId('elementList')
const elementCount = byId('elementCount')
const remoteFontList = byId('remoteFontList')
const remoteFontCount = byId('remoteFontCount')
const propertyForm = byId('propertyForm')
const propertiesSection = byId('propertiesSection')
const pagePreset = byId('pagePreset')
const pageWidth = byId('pageWidth')
const pageHeight = byId('pageHeight')
const landscape = byId('landscape')
const useDefaultPageSize = byId('useDefaultPageSize')
const imageInput = byId('imageInput')
const message = byId('message')
let canvasScale = 1
let rulerRenderKey = ''
let paperPopoverCloseTimer
const loadedRemoteFonts = new Map()

function selectedItem() {
  return state.items.find((item) => item.id === state.selectedId)
}

function setMessage(text, isError = false) {
  message.textContent = text
  message.className = isError ? 'message is-error' : 'message'
}

function requestPayload() {
  const fonts = validatedRemoteFonts()
  return {
    page: { ...state.page },
    landscape: state.landscape,
    margin: 0,
    fonts,
    texts: state.items
      .filter((item) => item.type === 'text')
      .map((item) => ({
        content: item.content,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        fontSizePt: item.fontSizePt,
        fontFamily: item.fontFamily,
        fontWeight: item.fontWeight,
        color: item.color,
        align: item.align,
        verticalAlign: item.verticalAlign,
        lineHeight: item.lineHeight,
        rotate: item.rotate
      })),
    images: state.items
      .filter((item) => item.type === 'image')
      .map((item) => ({
        src: item.src,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        fit: item.fit,
        rotate: item.rotate
      })),
    printer: {
      silent: true,
      copies: 1,
      useDefaultPageSize: state.useDefaultPageSize
    }
  }
}

function normalizeRemoteFont(font, index) {
  const label = `远程字体 ${index + 1}`
  const fontFamily = font.fontFamily.trim()
  const src = font.src.trim()
  if (!fontFamily) throw new Error(`${label}缺少字体名称。`)
  if (
    fontFamily.length > 200 ||
    Array.from(fontFamily).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint < 32 || codePoint === 127
    })
  ) {
    throw new Error(`${label}的字体名称无效。`)
  }
  if (!src) throw new Error(`${label}缺少字体链接。`)
  if (src.length > 4096) throw new Error(`${label}的字体链接过长。`)
  let url
  try {
    url = new URL(src)
  } catch {
    throw new Error(`${label}的链接无效。`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label}只支持不包含账号密码的 HTTPS 地址。`)
  }
  return {
    fontFamily,
    src: url.toString(),
    fontWeight: font.fontWeight,
    format: font.format
  }
}

function validatedRemoteFonts() {
  const keys = new Set()
  return state.fonts.map((font, index) => {
    const normalized = normalizeRemoteFont(font, index)
    const key = `${normalized.fontFamily}\u0000${normalized.fontWeight}`
    if (keys.has(key)) throw new Error(`远程字体 ${index + 1}的字体名称和字重与已有声明重复。`)
    keys.add(key)
    return normalized
  })
}

function orientedPage() {
  return state.landscape
    ? { widthMm: state.page.heightMm, heightMm: state.page.widthMm }
    : state.page
}

function control(label, value, onInput, options = {}) {
  const wrapper = document.createElement('label')
  wrapper.className = `field${options.wide ? ' field-wide' : ''}`
  const caption = document.createElement('span')
  caption.textContent = label
  let input
  if (options.type === 'textarea') {
    input = document.createElement('textarea')
    input.value = String(value)
  } else if (options.choices) {
    input = document.createElement('select')
    options.choices.forEach(([choiceValue, choiceLabel]) => {
      const option = document.createElement('option')
      option.value = choiceValue
      option.textContent = choiceLabel
      option.selected = choiceValue === String(value)
      input.append(option)
    })
  } else {
    input = document.createElement('input')
    input.type = options.type || 'number'
    input.value = String(value)
    if (options.step) input.step = options.step
  }
  input.addEventListener('input', () => onInput(input.value))
  wrapper.append(caption, input)
  return wrapper
}

function remoteFontControl(label, value, onChange, options = {}) {
  const wrapper = document.createElement('label')
  wrapper.className = `field${options.wide ? ' field-wide' : ''}`
  const caption = document.createElement('span')
  caption.textContent = label
  let input
  if (options.choices) {
    input = document.createElement('select')
    options.choices.forEach(([choiceValue, choiceLabel]) => {
      const option = document.createElement('option')
      option.value = choiceValue
      option.textContent = choiceLabel
      option.selected = String(value) === choiceValue
      input.append(option)
    })
  } else {
    input = document.createElement('input')
    input.type = 'text'
    input.value = String(value)
    input.placeholder = options.placeholder || ''
    input.autocomplete = 'off'
  }
  input.addEventListener('change', () => onChange(input.value))
  wrapper.append(caption, input)
  return { wrapper, input }
}

function removeLoadedRemoteFont(id) {
  const face = loadedRemoteFonts.get(id)
  if (!face) return
  document.fonts.delete(face)
  loadedRemoteFonts.delete(id)
}

async function loadRemoteFont(font, index, status, button, refresh = false) {
  try {
    const normalized = normalizeRemoteFont(font, index)
    const duplicate = state.fonts.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        candidate.fontFamily.trim() === normalized.fontFamily &&
        candidate.fontWeight === normalized.fontWeight
    )
    if (duplicate) throw new Error('字体名称和字重与已有声明重复。')
    status.textContent = refresh ? '正在刷新缓存…' : '正在读取字体缓存…'
    status.className = 'remote-font-status'
    button.disabled = true
    const result = await window.MPrint.cacheFont(normalized, { refresh })
    const source = `url(${JSON.stringify(result.fontUrl)}) format(${JSON.stringify(normalized.format)})`
    const face = new FontFace(normalized.fontFamily, source, {
      weight: String(normalized.fontWeight),
      style: 'normal'
    })
    await face.load()
    removeLoadedRemoteFont(font.id)
    document.fonts.add(face)
    loadedRemoteFonts.set(font.id, face)
    fontFamilies.add(normalized.fontFamily)
    status.textContent = result.source === 'download' ? '已下载并加载本地缓存' : '已从本地缓存加载'
    status.className = 'remote-font-status is-loaded'
    renderProperties()
    renderCanvas()
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
    status.className = 'remote-font-status is-error'
  } finally {
    button.disabled = false
  }
}

async function clearRemoteFontCache(font, index, status, button) {
  try {
    const normalized = normalizeRemoteFont(font, index)
    button.disabled = true
    const result = await window.MPrint.removeCachedFont(normalized)
    removeLoadedRemoteFont(font.id)
    status.textContent = result.removed ? '本地缓存已清除' : '本地没有该字体缓存'
    status.className = 'remote-font-status'
    renderCanvas()
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
    status.className = 'remote-font-status is-error'
  } finally {
    button.disabled = false
  }
}

function renderRemoteFonts() {
  remoteFontList.replaceChildren()
  remoteFontCount.textContent = `${state.fonts.length} 个`
  if (!state.fonts.length) {
    const empty = document.createElement('div')
    empty.className = 'remote-font-empty'
    empty.textContent = '尚未声明远程字体'
    remoteFontList.append(empty)
    return
  }

  state.fonts.forEach((font, index) => {
    const card = document.createElement('div')
    card.className = 'remote-font-card'
    const status = document.createElement('span')
    status.className = 'remote-font-status'
    status.textContent = loadedRemoteFonts.has(font.id) ? '已从本地缓存加载' : '尚未加载字体缓存'
    if (loadedRemoteFonts.has(font.id)) status.classList.add('is-loaded')
    const resetLoadedState = () => {
      removeLoadedRemoteFont(font.id)
      status.textContent = '配置已更改，请重新加载'
      status.className = 'remote-font-status'
    }
    const family = remoteFontControl(
      '字体名称',
      font.fontFamily,
      (value) => {
        resetLoadedState()
        const previousFamily = font.fontFamily
        font.fontFamily = value
        state.items.forEach((item) => {
          if (item.type === 'text' && item.fontFamily === previousFamily) item.fontFamily = value
        })
        renderProperties()
        renderCanvas()
      },
      { placeholder: '例如 Brand Font' }
    )
    const url = remoteFontControl(
      'HTTPS 字体链接',
      font.src,
      (value) => {
        resetLoadedState()
        font.src = value
      },
      { wide: true, placeholder: 'https://example.com/font.woff2' }
    )
    const weight = remoteFontControl(
      '字重',
      font.fontWeight,
      (value) => {
        resetLoadedState()
        font.fontWeight = Number(value)
      },
      {
        choices: [
          ['400', '400 常规'],
          ['500', '500 中等'],
          ['700', '700 粗体']
        ]
      }
    )
    const format = remoteFontControl(
      '格式',
      font.format,
      (value) => {
        resetLoadedState()
        font.format = value
      },
      {
        choices: [
          ['woff2', 'WOFF2'],
          ['woff', 'WOFF'],
          ['truetype', 'TTF'],
          ['opentype', 'OTF']
        ]
      }
    )
    const footer = document.createElement('div')
    footer.className = 'remote-font-footer'
    const actions = document.createElement('div')
    actions.className = 'remote-font-actions'
    const loadButton = document.createElement('button')
    loadButton.type = 'button'
    loadButton.className = 'remote-font-load'
    loadButton.textContent = '加载'
    loadButton.title = '优先读取本地缓存；没有缓存时才从远程下载'
    loadButton.addEventListener('click', () => void loadRemoteFont(font, index, status, loadButton))
    const refreshButton = document.createElement('button')
    refreshButton.type = 'button'
    refreshButton.className = 'remote-font-load'
    refreshButton.textContent = '刷新'
    refreshButton.title = '重新下载远程字体并替换本地缓存'
    refreshButton.addEventListener(
      'click',
      () => void loadRemoteFont(font, index, status, refreshButton, true)
    )
    const clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'remote-font-clear'
    clearButton.textContent = '清缓存'
    clearButton.title = '删除本机保存的字体文件，但保留当前字体声明'
    clearButton.addEventListener(
      'click',
      () => void clearRemoteFontCache(font, index, status, clearButton)
    )
    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'remote-font-delete'
    deleteButton.textContent = '删除'
    deleteButton.addEventListener('click', () => {
      const referenceCount = state.items.filter(
        (item) => item.type === 'text' && item.fontFamily === font.fontFamily
      ).length
      removeLoadedRemoteFont(font.id)
      state.fonts.splice(index, 1)
      renderRemoteFonts()
      renderProperties()
      renderCanvas()
      if (referenceCount) {
        setMessage(`字体声明已删除，仍有 ${referenceCount} 个文字元素引用该字体。`, true)
      }
    })
    actions.append(loadButton, refreshButton, clearButton, deleteButton)
    footer.append(status, actions)
    card.append(family.wrapper, url.wrapper, weight.wrapper, format.wrapper, footer)
    remoteFontList.append(card)
  })
}

function updateSelected(key, value) {
  const item = selectedItem()
  if (!item) return
  item[key] = value
  renderList()
  renderCanvas()
}

function fillFontOptions(datalist) {
  datalist.replaceChildren()
  const availableFamilies = new Set([
    ...fontFamilies,
    ...state.fonts.map((font) => font.fontFamily.trim()).filter(Boolean)
  ])
  Array.from(availableFamilies)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .forEach((family) => {
      const option = document.createElement('option')
      option.value = family
      datalist.append(option)
    })
}

async function loadSystemFonts(button, datalist) {
  if (typeof window.queryLocalFonts !== 'function') {
    setMessage('当前浏览器不支持读取系统字体，可直接输入打印电脑已安装的字体名称。', true)
    return
  }

  const originalLabel = button.textContent
  button.disabled = true
  button.textContent = '读取中…'
  try {
    const fonts = await window.queryLocalFonts()
    const loadedFamilies = new Set()
    fonts.forEach((font) => {
      if (typeof font.family === 'string' && font.family.trim()) {
        loadedFamilies.add(font.family.trim())
        fontFamilies.add(font.family.trim())
      }
    })
    availableSystemFontCount = loadedFamilies.size
    fillFontOptions(datalist)
    button.textContent = `系统字体 ${availableSystemFontCount}`
    button.classList.add('is-loaded')
    button.setAttribute('aria-label', `重新读取系统字体，当前已读取 ${availableSystemFontCount} 个`)
    setMessage(`已读取 ${availableSystemFontCount} 个可用字体，可输入名称筛选。`)
  } catch (error) {
    button.textContent = originalLabel
    const denied = error instanceof DOMException && error.name === 'NotAllowedError'
    setMessage(
      denied
        ? '未获得系统字体权限，可直接输入打印电脑已安装的字体名称。'
        : '系统字体读取失败，可直接输入打印电脑已安装的字体名称。',
      true
    )
  } finally {
    button.disabled = false
  }
}

function fontControl(item) {
  const wrapper = document.createElement('div')
  wrapper.className = 'field font-field'
  const heading = document.createElement('div')
  heading.className = 'field-heading'
  const caption = document.createElement('label')
  caption.textContent = '字体'
  caption.setAttribute('for', 'fontFamilyInput')
  const loadButton = document.createElement('button')
  loadButton.type = 'button'
  loadButton.className = 'field-link'
  loadButton.textContent = availableSystemFontCount
    ? `系统字体 ${availableSystemFontCount}`
    : '读取系统字体'
  if (availableSystemFontCount) {
    loadButton.classList.add('is-loaded')
    loadButton.setAttribute(
      'aria-label',
      `重新读取系统字体，当前已读取 ${availableSystemFontCount} 个`
    )
  }
  const input = document.createElement('input')
  input.type = 'text'
  input.id = 'fontFamilyInput'
  input.value = item.fontFamily || 'Microsoft YaHei'
  input.placeholder = '输入或选择字体名称'
  input.title = '选择系统字体或已声明的远程字体，也可以直接输入名称'
  input.setAttribute('list', 'fontFamilyOptions')
  input.autocomplete = 'off'
  const datalist = document.createElement('datalist')
  datalist.id = 'fontFamilyOptions'
  fontFamilies.add(input.value)
  fillFontOptions(datalist)
  input.addEventListener('input', () => updateSelected('fontFamily', input.value))
  loadButton.addEventListener('click', (event) => {
    event.preventDefault()
    void loadSystemFonts(loadButton, datalist)
  })
  heading.append(caption, loadButton)
  wrapper.append(heading, input, datalist)
  return wrapper
}

function renderProperties() {
  propertyForm.replaceChildren()
  const item = selectedItem()
  propertiesSection.hidden = !item
  if (!item) return

  if (item.type === 'text') {
    propertyForm.append(
      control('文字内容', item.content, (value) => updateSelected('content', value), {
        type: 'textarea',
        wide: true
      }),
      fontControl(item),
      control(
        '字号 pt',
        item.fontSizePt || 12,
        (value) => updateSelected('fontSizePt', Number(value)),
        { step: '1' }
      ),
      control(
        '字重',
        item.fontWeight || 400,
        (value) => updateSelected('fontWeight', Number(value)),
        {
          choices: [
            ['400', '常规'],
            ['500', '中等'],
            ['700', '粗体']
          ]
        }
      ),
      control('颜色', item.color || '#000000', (value) => updateSelected('color', value), {
        type: 'color'
      }),
      control(
        '行高',
        item.lineHeight || 1.2,
        (value) => updateSelected('lineHeight', Number(value)),
        { step: '0.1' }
      )
    )
  } else {
    propertyForm.append(
      control('填充方式', item.fit || 'fill', (value) => updateSelected('fit', value), {
        wide: true,
        choices: [
          ['fill', '拉伸填充'],
          ['contain', '完整显示'],
          ['cover', '裁切铺满']
        ]
      })
    )
  }

  const geometrySection = document.createElement('div')
  geometrySection.className = 'advanced-properties'
  const geometryHeading = document.createElement('div')
  geometryHeading.className = 'geometry-heading'
  const geometryTitle = document.createElement('strong')
  geometryTitle.textContent = '位置与尺寸'
  const geometryMeta = document.createElement('span')
  geometryMeta.textContent = `${item.xMm}, ${item.yMm} · ${item.widthMm} × ${item.heightMm} mm`
  geometryHeading.append(geometryTitle, geometryMeta)
  const geometryGrid = document.createElement('div')
  geometryGrid.className = 'form-grid geometry-grid'
  geometryGrid.append(
    control('X mm', item.xMm, (value) => updateSelected('xMm', Number(value)), { step: '0.1' }),
    control('Y mm', item.yMm, (value) => updateSelected('yMm', Number(value)), { step: '0.1' }),
    control('宽度 mm', item.widthMm, (value) => updateSelected('widthMm', Number(value)), {
      step: '0.1'
    }),
    control('高度 mm', item.heightMm, (value) => updateSelected('heightMm', Number(value)), {
      step: '0.1'
    }),
    control('旋转', item.rotate || 0, (value) => updateSelected('rotate', Number(value)), {
      choices: [
        ['0', '0°'],
        ['90', '90°'],
        ['180', '180°'],
        ['270', '270°']
      ]
    })
  )
  geometrySection.append(geometryHeading, geometryGrid)
  propertyForm.append(geometrySection)
}

function renderList() {
  elementList.replaceChildren()
  elementCount.textContent = `${state.items.length} 个`
  state.items.forEach((item, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `element-item${item.id === state.selectedId ? ' is-selected' : ''}`
    const label = document.createElement('span')
    const title = document.createElement('strong')
    title.textContent = item.type === 'text' ? item.content || '空文字' : item.name
    const detail = document.createElement('small')
    detail.textContent = `${item.type === 'text' ? '文字' : '图片'} · ${item.xMm}, ${item.yMm} mm`
    label.append(title, detail)
    const order = document.createElement('span')
    order.className = 'element-index'
    order.textContent = String(index + 1).padStart(2, '0')
    button.append(label, order)
    button.addEventListener('click', () => {
      state.selectedId = item.id
      render(true)
    })
    elementList.append(button)
  })
}

function startDrag(event, item) {
  event.preventDefault()
  state.selectedId = item.id
  const startX = event.clientX
  const startY = event.clientY
  const initialX = item.xMm
  const initialY = item.yMm
  const move = (moveEvent) => {
    item.xMm = Math.round((initialX + (moveEvent.clientX - startX) / canvasScale) * 10) / 10
    item.yMm = Math.round((initialY + (moveEvent.clientY - startY) / canvasScale) * 10) / 10
    renderCanvas()
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    render(true)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end, { once: true })
}

function rulerDensity(scale) {
  if (scale >= 4) return { tickStepMm: 1, labelStepMm: 10 }
  if (scale >= 2) return { tickStepMm: 2, labelStepMm: 20 }
  return { tickStepMm: 5, labelStepMm: 50 }
}

function renderRulerAxis(ruler, lengthMm, originPx, axis) {
  const { tickStepMm, labelStepMm } = rulerDensity(canvasScale)
  const fragment = document.createDocumentFragment()
  const tickCount = Math.floor(lengthMm / tickStepMm)

  for (let index = 0; index <= tickCount; index += 1) {
    const mm = index * tickStepMm
    const position = originPx + mm * canvasScale
    const tick = document.createElement('span')
    tick.className = `ruler-tick${mm % 10 === 0 ? ' is-major' : mm % 5 === 0 ? ' is-medium' : ''}`
    tick.style[axis] = `${position}px`
    fragment.append(tick)

    if (mm % labelStepMm === 0) {
      const label = document.createElement('span')
      label.className = 'ruler-label'
      label.textContent = String(mm)
      label.style[axis] = `${position}px`
      fragment.append(label)
    }
  }

  ruler.replaceChildren(fragment)
}

function renderRulers(size) {
  const xOrigin = paper.offsetLeft - rulerX.offsetLeft
  const yOrigin = paper.offsetTop - rulerY.offsetTop
  const renderKey = [
    size.widthMm,
    size.heightMm,
    canvasScale.toFixed(4),
    xOrigin.toFixed(2),
    yOrigin.toFixed(2),
    rulerX.clientWidth,
    rulerY.clientHeight
  ].join(':')
  if (renderKey === rulerRenderKey) return

  rulerRenderKey = renderKey
  renderRulerAxis(rulerX, size.widthMm, xOrigin, 'left')
  renderRulerAxis(rulerY, size.heightMm, yOrigin, 'top')
}

function renderCanvas() {
  const size = orientedPage()
  const selected = selectedItem()
  canvasToolbar.hidden = !selected
  textAlignToolbar.hidden = selected?.type !== 'text'
  if (selected?.type === 'text') {
    textAlignButtons.forEach((button) => {
      button.classList.toggle(
        'is-active',
        button.dataset.textAlign === (selected.align || defaultTextAlign)
      )
    })
    verticalAlignButtons.forEach((button) => {
      button.classList.toggle(
        'is-active',
        button.dataset.verticalAlign === (selected.verticalAlign || defaultTextVerticalAlign)
      )
    })
  }
  const maxWidth = Math.max(420, stage.clientWidth - 150)
  const maxHeight = Math.max(420, stage.clientHeight - 130)
  canvasScale = Math.min(maxWidth / size.widthMm, maxHeight / size.heightMm)
  paper.style.width = `${size.widthMm * canvasScale}px`
  paper.style.height = `${size.heightMm * canvasScale}px`
  renderRulers(size)
  paper.replaceChildren()

  state.items.forEach((item) => {
    let visual
    if (item.type === 'image') {
      visual = document.createElement('img')
      visual.src = item.src
      visual.alt = item.name
      visual.style.objectFit = ['contain', 'cover'].includes(item.fit) ? item.fit : 'fill'
    } else {
      visual = document.createElement('div')
      visual.textContent = item.content
      visual.style.fontSize = `${(item.fontSizePt || 12) * (96 / 72) * (canvasScale / 3.78)}px`
      visual.style.fontFamily = item.fontFamily || 'Microsoft YaHei'
      visual.style.fontWeight = String(item.fontWeight || 400)
      visual.style.lineHeight = String(item.lineHeight || 1.2)
      visual.style.color = item.color || '#000000'
      visual.style.textAlign = item.align || defaultTextAlign
      visual.style.display = 'flex'
      visual.style.flexDirection = 'column'
      const verticalAlign = item.verticalAlign || defaultTextVerticalAlign
      visual.style.justifyContent =
        verticalAlign === 'middle'
          ? 'center'
          : verticalAlign === 'bottom'
            ? 'flex-end'
            : 'flex-start'
      visual.style.whiteSpace = 'pre-wrap'
      visual.style.overflowWrap = 'anywhere'
    }
    visual.className = `preview-item${item.id === state.selectedId ? ' is-selected' : ''}`
    visual.style.left = `${item.xMm * canvasScale}px`
    visual.style.top = `${item.yMm * canvasScale}px`
    visual.style.width = `${item.widthMm * canvasScale}px`
    visual.style.height = `${item.heightMm * canvasScale}px`
    visual.style.transform = `rotate(${item.rotate || 0}deg)`
    visual.addEventListener('pointerdown', (event) => startDrag(event, item))
    visual.addEventListener('click', () => {
      state.selectedId = item.id
      render(true)
    })
    paper.append(visual)
  })
  paperSummary.textContent = state.useDefaultPageSize
    ? `默认 · ${size.widthMm} × ${size.heightMm}`
    : `${size.widthMm} × ${size.heightMm} mm`
  paperMeta.textContent = state.useDefaultPageSize
    ? `打印机默认纸张 · 模板 ${size.widthMm} × ${size.heightMm} mm · ${Math.round(canvasScale * 100) / 100}px/mm`
    : `${size.widthMm} × ${size.heightMm} mm · ${Math.round(canvasScale * 100) / 100}px/mm`
}

function render(withProperties = false) {
  renderList()
  renderCanvas()
  if (withProperties) renderProperties()
}

function centeredDefaultGeometry(maxWidthMm, maxHeightMm) {
  const size = orientedPage()
  const insetX = Math.min(10, size.widthMm * 0.1)
  const insetY = Math.min(10, size.heightMm * 0.1)
  const widthMm =
    Math.round(Math.max(0.1, Math.min(maxWidthMm, size.widthMm - insetX * 2)) * 10) / 10
  const heightMm =
    Math.round(Math.max(0.1, Math.min(maxHeightMm, size.heightMm - insetY * 2)) * 10) / 10
  return {
    xMm: Math.round(Math.max(0, (size.widthMm - widthMm) / 2) * 10) / 10,
    yMm: Math.round(Math.max(0, (size.heightMm - heightMm) / 2) * 10) / 10,
    widthMm,
    heightMm
  }
}

function addText() {
  const geometry = centeredDefaultGeometry(60, 10)
  const item = {
    id: crypto.randomUUID(),
    type: 'text',
    content: '新文字',
    ...geometry,
    fontSizePt: 12,
    fontFamily: 'Microsoft YaHei',
    fontWeight: 400,
    color: '#24211c',
    align: defaultTextAlign,
    verticalAlign: defaultTextVerticalAlign,
    lineHeight: 1.2,
    rotate: 0
  }
  state.items.push(item)
  state.selectedId = item.id
  render(true)
}

function positionSelected(mode) {
  const item = selectedItem()
  if (!item) {
    setMessage('请先选择一个元素。', true)
    return
  }
  const size = orientedPage()
  if (mode === 'left') item.xMm = 0
  if (mode === 'horizontal' || mode === 'center') {
    item.xMm = Math.round(Math.max(0, (size.widthMm - item.widthMm) / 2) * 10) / 10
  }
  if (mode === 'right') item.xMm = Math.max(0, Math.round((size.widthMm - item.widthMm) * 10) / 10)
  if (mode === 'top') item.yMm = 0
  if (mode === 'vertical' || mode === 'center') {
    item.yMm = Math.round(Math.max(0, (size.heightMm - item.heightMm) / 2) * 10) / 10
  }
  if (mode === 'bottom')
    item.yMm = Math.max(0, Math.round((size.heightMm - item.heightMm) * 10) / 10)
  const labels = {
    left: '元素已对齐纸张左侧。',
    horizontal: '元素已水平居中。',
    right: '元素已对齐纸张右侧。',
    top: '元素已对齐纸张顶部。',
    vertical: '元素已垂直居中。',
    bottom: '元素已对齐纸张底部。',
    center: '元素已移动到页面中心。'
  }
  setMessage(labels[mode] || '元素位置已更新。')
  render(true)
}

async function addImage(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20MB。')
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(file)
  })
  const geometry = centeredDefaultGeometry(40, 30)
  const item = {
    id: crypto.randomUUID(),
    type: 'image',
    name: file.name,
    src,
    ...geometry,
    fit: 'contain',
    rotate: 0
  }
  state.items.push(item)
  state.selectedId = item.id
  render(true)
}

async function runAction(button, busyText, action) {
  const labelElement = button.querySelector('.button-label') || button
  const label = labelElement.textContent
  button.disabled = true
  labelElement.textContent = busyText
  setMessage('')
  try {
    await action()
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), true)
  } finally {
    button.disabled = false
    labelElement.textContent = label
  }
}

pageWidth.value = String(state.page.widthMm)
pageHeight.value = String(state.page.heightMm)
function setPaperPopover(open) {
  if (!open && !paperPopover.classList.contains('is-open')) return
  window.clearTimeout(paperPopoverCloseTimer)
  paperSettingsButton.setAttribute('aria-expanded', String(open))
  paperPopover.setAttribute('aria-hidden', String(!open))
  paperPopover.inert = !open
  if (open) {
    paperPopover.classList.remove('is-closing')
    paperPopover.classList.add('is-open')
    return
  }
  paperPopover.classList.remove('is-open')
  paperPopover.classList.add('is-closing')
  const closeMs =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')
    ) || 150
  paperPopoverCloseTimer = window.setTimeout(() => {
    paperPopover.classList.remove('is-closing')
  }, closeMs)
}
paperSettingsButton.addEventListener('click', () => {
  setPaperPopover(!paperPopover.classList.contains('is-open'))
})
byId('closePaperPopover').addEventListener('click', () => {
  setPaperPopover(false)
  paperSettingsButton.focus()
})
document.addEventListener('click', (event) => {
  if (!paperControl.contains(event.target)) setPaperPopover(false)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && paperPopover.classList.contains('is-open')) {
    setPaperPopover(false)
    paperSettingsButton.focus()
  }
})
pagePreset.addEventListener('change', () => {
  const preset = presets[pagePreset.value]
  if (preset) {
    state.page = { ...preset }
    pageWidth.value = String(preset.widthMm)
    pageHeight.value = String(preset.heightMm)
  }
  render()
})
const updatePaper = () => {
  state.page.widthMm = Math.max(1, Number(pageWidth.value) || 1)
  state.page.heightMm = Math.max(1, Number(pageHeight.value) || 1)
  pagePreset.value = 'custom'
  render()
}
pageWidth.addEventListener('input', updatePaper)
pageHeight.addEventListener('input', updatePaper)
landscape.addEventListener('change', () => {
  state.landscape = landscape.checked
  render()
})
useDefaultPageSize.addEventListener('change', () => {
  state.useDefaultPageSize = useDefaultPageSize.checked
  setMessage(
    state.useDefaultPageSize
      ? '打印时将使用打印机默认纸张；模板宽高继续用于布局与预览。'
      : '打印时将使用当前模板纸张尺寸。'
  )
  render()
})
textAlignButtons.forEach((button) => {
  button.addEventListener('click', () => updateSelected('align', button.dataset.textAlign))
})
verticalAlignButtons.forEach((button) => {
  button.addEventListener('click', () =>
    updateSelected('verticalAlign', button.dataset.verticalAlign)
  )
})
byId('addText').addEventListener('click', addText)
byId('addImage').addEventListener('click', () => imageInput.click())
byId('addRemoteFont').addEventListener('click', () => {
  if (state.fonts.length >= 10) {
    setMessage('远程字体最多添加 10 个。', true)
    return
  }
  state.fonts.push({
    id: crypto.randomUUID(),
    fontFamily: `Remote Font ${state.fonts.length + 1}`,
    src: '',
    fontWeight: 400,
    format: 'woff2'
  })
  renderRemoteFonts()
  renderProperties()
  remoteFontList.querySelector('.remote-font-card:last-child input')?.focus()
})
byId('clearFontCache').addEventListener('click', (event) =>
  runAction(event.currentTarget, '清理中…', async () => {
    const result = await window.MPrint.clearFontCache()
    loadedRemoteFonts.forEach((face) => document.fonts.delete(face))
    loadedRemoteFonts.clear()
    renderRemoteFonts()
    renderCanvas()
    setMessage(`已清除 ${result.removed} 个字体缓存文件。`)
  })
)
document.querySelectorAll('[data-position]').forEach((button) => {
  button.addEventListener('click', () => positionSelected(button.dataset.position))
})
imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0]
  if (!file) return
  try {
    await addImage(file)
    setMessage(`已添加图片：${file.name}`)
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), true)
  } finally {
    imageInput.value = ''
  }
})
byId('deleteElement').addEventListener('click', () => {
  const index = state.items.findIndex((item) => item.id === state.selectedId)
  if (index < 0) return
  state.items.splice(index, 1)
  state.selectedId = state.items[Math.min(index, state.items.length - 1)]?.id || null
  render(true)
})
byId('copyButton').addEventListener('click', async (event) => {
  const button = event.currentTarget
  const label = button.querySelector('.button-label')
  try {
    await navigator.clipboard.writeText(
      `await MPrint.print(${JSON.stringify(requestPayload(), null, 2)})`
    )
    setMessage('当前模板调用代码已复制。')
    label.textContent = '已复制'
    window.setTimeout(() => {
      label.textContent = '复制当前代码'
    }, 1500)
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), true)
  }
})
byId('previewButton').addEventListener('click', (event) =>
  runAction(event.currentTarget, '正在打开…', async () => {
    await window.MPrint.preview(requestPayload())
    setMessage('已打开打印预览窗口。')
  })
)
byId('printButton').addEventListener('click', (event) =>
  runAction(event.currentTarget, '打印中…', async () => {
    const result = await window.MPrint.print(requestPayload())
    if (!result.success) throw new Error(result.failureReason || '打印失败。')
    setMessage('打印任务已提交。')
  })
)
window.addEventListener('resize', renderCanvas)
renderRemoteFonts()
render(true)
