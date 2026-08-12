/* eslint-disable @typescript-eslint/explicit-function-return-type */

const presets = {
  card: { widthMm: 86, heightMm: 54 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A6: { widthMm: 105, heightMm: 148 },
  'photo-6in': { widthMm: 102, heightMm: 152 }
}

const state = {
  page: { ...presets.card },
  landscape: false,
  useDefaultPageSize: false,
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
      align: 'left',
      verticalAlign: 'top',
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
      align: 'left',
      verticalAlign: 'top',
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
const paperMeta = byId('paperMeta')
const paperSummary = byId('paperSummary')
const paperControl = byId('paperControl')
const paperSettingsButton = byId('paperSettingsButton')
const paperPopover = byId('paperPopover')
const canvasToolbar = byId('canvasToolbar')
const elementList = byId('elementList')
const elementCount = byId('elementCount')
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

function selectedItem() {
  return state.items.find((item) => item.id === state.selectedId)
}

function setMessage(text, isError = false) {
  message.textContent = text
  message.className = isError ? 'message is-error' : 'message'
}

function requestPayload() {
  return {
    page: { ...state.page },
    landscape: state.landscape,
    margin: 0,
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

function updateSelected(key, value) {
  const item = selectedItem()
  if (!item) return
  item[key] = value
  renderList()
  renderCanvas()
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
      control(
        '字体',
        item.fontFamily || 'Microsoft YaHei',
        (value) => updateSelected('fontFamily', value),
        {
          choices: [
            ['Microsoft YaHei', '微软雅黑'],
            ['SimSun', '宋体'],
            ['SimHei', '黑体'],
            ['Arial', 'Arial']
          ]
        }
      ),
      control('对齐', item.align || 'left', (value) => updateSelected('align', value), {
        choices: [
          ['left', '左对齐'],
          ['center', '居中'],
          ['right', '右对齐']
        ]
      }),
      control(
        '垂直对齐',
        item.verticalAlign || 'top',
        (value) => updateSelected('verticalAlign', value),
        {
          choices: [
            ['top', '顶部'],
            ['middle', '居中'],
            ['bottom', '底部']
          ]
        }
      ),
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

  const details = document.createElement('details')
  details.className = 'advanced-properties'
  const summary = document.createElement('summary')
  const summaryTitle = document.createElement('strong')
  summaryTitle.textContent = '位置与尺寸'
  const summaryMeta = document.createElement('span')
  summaryMeta.textContent = `${item.xMm}, ${item.yMm} · ${item.widthMm} × ${item.heightMm} mm`
  summary.append(summaryTitle, summaryMeta)
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
  details.append(summary, geometryGrid)
  propertyForm.append(details)
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

function renderCanvas() {
  const size = orientedPage()
  canvasToolbar.hidden = !selectedItem()
  const maxWidth = Math.max(420, stage.clientWidth - 150)
  const maxHeight = Math.max(420, stage.clientHeight - 130)
  canvasScale = Math.min(maxWidth / size.widthMm, maxHeight / size.heightMm)
  paper.style.width = `${size.widthMm * canvasScale}px`
  paper.style.height = `${size.heightMm * canvasScale}px`
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
      visual.style.textAlign = item.align || 'left'
      visual.style.display = 'flex'
      visual.style.flexDirection = 'column'
      visual.style.justifyContent =
        item.verticalAlign === 'middle'
          ? 'center'
          : item.verticalAlign === 'bottom'
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

function addText() {
  const item = {
    id: crypto.randomUUID(),
    type: 'text',
    content: '新文字',
    xMm: 10,
    yMm: 10,
    widthMm: Math.max(1, Math.min(60, state.page.widthMm - 20)),
    heightMm: 10,
    fontSizePt: 12,
    fontFamily: 'Microsoft YaHei',
    fontWeight: 400,
    color: '#24211c',
    align: 'left',
    verticalAlign: 'top',
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
  const item = {
    id: crypto.randomUUID(),
    type: 'image',
    name: file.name,
    src,
    xMm: 10,
    yMm: 10,
    widthMm: Math.max(1, Math.min(40, state.page.widthMm - 20)),
    heightMm: Math.max(1, Math.min(30, state.page.heightMm - 20)),
    fit: 'contain',
    rotate: 0
  }
  state.items.push(item)
  state.selectedId = item.id
  render(true)
}

async function runAction(button, busyText, action) {
  const label = button.textContent
  button.disabled = true
  button.textContent = busyText
  setMessage('')
  try {
    await action()
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), true)
  } finally {
    button.disabled = false
    button.textContent = label
  }
}

pageWidth.value = String(state.page.widthMm)
pageHeight.value = String(state.page.heightMm)
function setPaperPopover(open) {
  paperPopover.hidden = !open
  paperSettingsButton.setAttribute('aria-expanded', String(open))
}
paperSettingsButton.addEventListener('click', () => setPaperPopover(paperPopover.hidden))
byId('closePaperPopover').addEventListener('click', () => setPaperPopover(false))
document.addEventListener('click', (event) => {
  if (!paperControl.contains(event.target)) setPaperPopover(false)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
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
byId('addText').addEventListener('click', addText)
byId('addImage').addEventListener('click', () => imageInput.click())
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
  await navigator.clipboard.writeText(
    `await MPrint.print(${JSON.stringify(requestPayload(), null, 2)})`
  )
  setMessage('当前模板调用代码已复制。')
  button.textContent = '已复制'
  window.setTimeout(() => {
    button.textContent = '复制当前代码'
  }, 1500)
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
render(true)
