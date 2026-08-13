import type { AppSettings, PrinterSummary, ServiceStatus } from '../../shared/print-types'

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id)
  if (!value) throw new Error(`页面缺少元素：${id}`)
  return value as T
}

const headerStatus = element<HTMLDivElement>('headerStatus')
const serviceState = element<HTMLElement>('serviceState')
const serviceVersion = element<HTMLElement>('serviceVersion')
const serviceDescription = element<HTMLElement>('serviceDescription')
const serviceAddress = element<HTMLElement>('serviceAddress')
const sdkAddress = element<HTMLElement>('sdkAddress')
const editorAddress = element<HTMLElement>('editorAddress')
const sdkCode = element<HTMLElement>('sdkCode')
const settingsForm = element<HTMLFormElement>('settingsForm')
const portInput = element<HTMLInputElement>('portInput')
const autoLaunchInput = element<HTMLInputElement>('autoLaunchInput')
const closeToTrayInput = element<HTMLInputElement>('closeToTrayInput')
const settingsMessage = element<HTMLElement>('settingsMessage')
const printerList = element<HTMLElement>('printerList')

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function setBusy(button: HTMLButtonElement, busy: boolean, busyText: string): void {
  if (!button.dataset.label) button.dataset.label = button.textContent ?? ''
  button.disabled = busy
  button.textContent = busy ? busyText : button.dataset.label
}

function applyStatus(status: ServiceStatus): void {
  headerStatus.className = `status-chip ${status.running ? 'is-running' : 'is-error'}`
  headerStatus.lastElementChild!.textContent = status.running ? '服务运行中' : '服务未启动'
  serviceState.textContent = status.running ? '运行正常' : '启动失败'
  serviceVersion.textContent = `v${status.version}`
  serviceDescription.textContent = status.running
    ? '网页可以通过下方地址直接调用本机打印服务。'
    : status.lastError || '请修改端口或重新启动程序。'
  serviceAddress.textContent = `${status.host}:${status.port}`
  sdkAddress.textContent = status.sdkUrl
  editorAddress.textContent = status.editorUrl
  sdkCode.innerHTML = `<code>&lt;script src="${status.sdkUrl}"&gt;&lt;/script&gt;
&lt;script&gt;
  await MPrint.print({
    page: 'A4',
    texts: [{ content: '测试打印', xMm: 20, yMm: 20, widthMm: 80, heightMm: 12 }]
  })
&lt;/script&gt;</code>`
}

async function loadStatus(): Promise<void> {
  const [status, settings] = await Promise.all([window.api.getStatus(), window.api.getSettings()])
  applyStatus(status)
  portInput.value = String(settings.port)
  autoLaunchInput.checked = settings.autoLaunch
  closeToTrayInput.checked = settings.closeToTray
}

function renderPrinters(printers: PrinterSummary[]): void {
  printerList.replaceChildren()
  if (!printers.length) {
    printerList.innerHTML =
      '<div class="empty-state">没有检测到打印机，请先在 Windows 中安装打印机。</div>'
    return
  }
  printers.forEach((printer) => {
    const row = document.createElement('div')
    row.className = 'printer-row'
    const name = document.createElement('div')
    name.className = 'printer-name'
    const strong = document.createElement('strong')
    strong.textContent = printer.displayName || printer.name
    const description = document.createElement('small')
    description.textContent = printer.description || 'Windows 打印机'
    name.append(strong, description)
    const systemName = document.createElement('code')
    systemName.className = 'printer-system-name'
    systemName.textContent = printer.name
    const state = document.createElement('span')
    state.className = 'default-badge'
    state.textContent = printer.isDefault ? '默认' : `状态 ${printer.status}`
    row.append(name, systemName, state)
    printerList.append(row)
  })
}

async function loadPrinters(): Promise<void> {
  printerList.innerHTML = '<div class="empty-state">正在读取打印机列表…</div>'
  try {
    renderPrinters(await window.api.getPrinters())
  } catch (error) {
    printerList.innerHTML = `<div class="empty-state">读取失败：${errorMessage(error)}</div>`
  }
}

function bindEvents(): void {
  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = element<HTMLButtonElement>('saveSettingsButton')
    const nextSettings: AppSettings = {
      port: Number(portInput.value),
      autoLaunch: autoLaunchInput.checked,
      closeToTray: closeToTrayInput.checked
    }
    setBusy(button, true, '保存中…')
    settingsMessage.className = 'inline-message'
    settingsMessage.textContent = ''
    try {
      applyStatus(await window.api.saveSettings(nextSettings))
      settingsMessage.textContent = '设置已保存'
    } catch (error) {
      settingsMessage.className = 'inline-message is-error'
      settingsMessage.textContent = errorMessage(error)
    } finally {
      setBusy(button, false, '')
    }
  })

  element<HTMLButtonElement>('refreshPrintersButton').addEventListener(
    'click',
    () => void loadPrinters()
  )
  element<HTMLButtonElement>('copyCodeButton').addEventListener('click', async () => {
    await navigator.clipboard.writeText(sdkCode.textContent ?? '')
    const button = element<HTMLButtonElement>('copyCodeButton')
    button.textContent = '已复制'
    window.setTimeout(() => (button.textContent = '复制代码'), 1200)
  })
  element<HTMLButtonElement>('openEditorButton').addEventListener('click', async () => {
    const button = element<HTMLButtonElement>('openEditorButton')
    button.classList.add('is-opening')
    try {
      await window.api.openEditor()
    } catch (error) {
      settingsMessage.className = 'inline-message is-error'
      settingsMessage.textContent = `打开编辑器失败：${errorMessage(error)}`
    } finally {
      button.classList.remove('is-opening')
    }
  })
}

async function init(): Promise<void> {
  bindEvents()
  try {
    await loadStatus()
    await loadPrinters()
  } catch (error) {
    headerStatus.className = 'status-chip is-error'
    headerStatus.lastElementChild!.textContent = '初始化失败'
    serviceState.textContent = '读取失败'
    serviceDescription.textContent = errorMessage(error)
  }
}

void init()
