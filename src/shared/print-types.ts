export type PrintPagePreset =
  'A3' | 'A4' | 'A5' | 'A6' | 'Legal' | 'Letter' | 'Tabloid' | 'photo-5in' | 'photo-6in'

export type PrintPageSize =
  | PrintPagePreset
  | {
      widthMm: number
      heightMm: number
    }

export type PrintMargin =
  | number
  | {
      topMm?: number
      rightMm?: number
      bottomMm?: number
      leftMm?: number
    }

export type PrintImageFit = 'fill' | 'contain' | 'cover'

export type PrintFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype'

export type PrintFontFace = {
  fontFamily: string
  src: string
  fontWeight?: number | 'normal' | 'bold'
  format?: PrintFontFormat
}

export type PrintImageItem = {
  src: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  fit?: PrintImageFit
  rotate?: 0 | 90 | 180 | 270
}

export type PrintTextItem = {
  content: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  fontSizePt?: number
  fontFamily?: string
  fontWeight?: number | 'normal' | 'bold'
  color?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  rotate?: 0 | 90 | 180 | 270
}

export type PrintElement = ({ type: 'image' } & PrintImageItem) | ({ type: 'text' } & PrintTextItem)

export type PrintRequest = {
  page: PrintPageSize
  landscape?: boolean
  margin?: PrintMargin
  offset?: {
    xMm?: number
    yMm?: number
  }
  fonts?: PrintFontFace[]
  background?: PrintImageItem
  elements?: PrintElement[]
  images?: PrintImageItem[]
  texts?: PrintTextItem[]
  printer?: {
    silent?: boolean
    deviceName?: string
    copies?: number
    useDefaultPageSize?: boolean
  }
}

export type PrintResult = {
  success: boolean
  failureReason?: string
}

export type PrinterSummary = {
  name: string
  displayName: string
  description: string
  status: number
  isDefault: boolean
}

export type AppSettings = {
  port: number
  autoLaunch: boolean
  closeToTray: boolean
}

export type ServiceStatus = {
  running: boolean
  host: '127.0.0.1'
  port: number
  sdkUrl: string
  editorUrl: string
  version: string
  startedAt: string | null
  lastError: string | null
}

export type MPrintAPI = {
  getStatus: () => Promise<ServiceStatus>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<ServiceStatus>
  getPrinters: () => Promise<PrinterSummary[]>
  print: (request: PrintRequest) => Promise<PrintResult>
  preview: (request: PrintRequest) => Promise<void>
  openEditor: () => Promise<void>
}
