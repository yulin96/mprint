import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, type WebContents } from 'electron'
import type { AppSettings, PrinterSummary, PrintResult, ServiceStatus } from '../shared/print-types'
import { openPrintPreview, runPrint } from './print-engine'
import { PrintQueue } from './print-queue'

const host = '127.0.0.1' as const
const maxRequestBytes = 25 * 1024 * 1024

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  })
  response.end(JSON.stringify(body))
}

function writeError(response: ServerResponse, error: unknown, statusCode = 400): void {
  writeJson(response, statusCode, {
    success: false,
    error: error instanceof Error ? error.message : String(error)
  })
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers['content-length'] ?? 0)
  if (declaredLength > maxRequestBytes) throw new Error('请求体不能超过 25MB。')

  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    received += buffer.length
    if (received > maxRequestBytes) throw new Error('请求体不能超过 25MB。')
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('请求体不是有效的 JSON。')
  }
}

export class LocalPrintServer {
  private server: Server | null = null
  private settings: AppSettings
  private readonly queue = new PrintQueue()
  private startedAt: string | null = null
  private lastError: string | null = null

  constructor(
    settings: AppSettings,
    private readonly getWebContents: () => WebContents | null
  ) {
    this.settings = settings
  }

  getStatus(): ServiceStatus {
    return {
      running: this.server?.listening === true,
      host,
      port: this.settings.port,
      sdkUrl: `http://${host}:${this.settings.port}/mprint.js`,
      editorUrl: `http://${host}:${this.settings.port}/editor/`,
      version: app.getVersion(),
      startedAt: this.startedAt,
      lastError: this.lastError
    }
  }

  async start(): Promise<ServiceStatus> {
    if (this.server?.listening) return this.getStatus()
    this.lastError = null
    this.server = createServer((request, response) => void this.handle(request, response))

    try {
      await new Promise<void>((resolve, reject) => {
        this.server?.once('error', reject)
        this.server?.listen(this.settings.port, host, () => resolve())
      })
      this.startedAt = new Date().toISOString()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.server = null
    }
    return this.getStatus()
  }

  async restart(settings: AppSettings): Promise<ServiceStatus> {
    await this.stop()
    this.settings = settings
    return this.start()
  }

  async stop(): Promise<void> {
    if (!this.server) return
    const server = this.server
    this.server = null
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  async getPrinters(): Promise<PrinterSummary[]> {
    const contents = this.getWebContents()
    if (!contents || contents.isDestroyed()) throw new Error('管理窗口尚未准备完成。')
    const printers = await contents.getPrintersAsync()
    return printers.map((printer) => {
      const runtimePrinter = printer as typeof printer & { status?: number; isDefault?: boolean }
      return {
        name: printer.name,
        displayName: printer.displayName,
        description: printer.description,
        status: runtimePrinter.status ?? Number(printer.options['printer-state'] ?? 0),
        isDefault: runtimePrinter.isDefault ?? printer.options['is-default'] === 'true'
      }
    })
  }

  print(value: unknown): Promise<PrintResult> {
    return this.queue.add(() => runPrint(value))
  }

  preview(value: unknown): Promise<void> {
    return openPrintPreview(value)
  }

  private async serveSdk(response: ServerResponse): Promise<void> {
    const sdkPath = join(app.getAppPath(), 'resources', 'sdk', 'mprint.js')
    const content = await readFile(sdkPath, 'utf8')
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    })
    response.end(content)
  }

  private async serveEditor(response: ServerResponse, fileName: string): Promise<void> {
    const contentTypes: Record<string, string> = {
      'index.html': 'text/html; charset=utf-8',
      'editor.css': 'text/css; charset=utf-8',
      'editor.js': 'text/javascript; charset=utf-8'
    }
    const content = await readFile(join(app.getAppPath(), 'resources', 'editor', fileName))
    response.writeHead(200, {
      'Content-Type': contentTypes[fileName] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    response.end(content)
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === 'OPTIONS') {
      writeJson(response, 204, null)
      return
    }

    const url = new URL(request.url ?? '/', `http://${host}:${this.settings.port}`)
    try {
      if (request.method === 'GET' && url.pathname === '/mprint.js') {
        await this.serveSdk(response)
        return
      }
      if (request.method === 'GET' && (url.pathname === '/editor' || url.pathname === '/editor/')) {
        await this.serveEditor(response, 'index.html')
        return
      }
      if (request.method === 'GET' && url.pathname === '/editor/editor.css') {
        await this.serveEditor(response, 'editor.css')
        return
      }
      if (request.method === 'GET' && url.pathname === '/editor/editor.js') {
        await this.serveEditor(response, 'editor.js')
        return
      }
      if (request.method === 'GET' && url.pathname === '/v1/health') {
        writeJson(response, 200, { success: true, ...this.getStatus(), queueSize: this.queue.size })
        return
      }
      if (request.method === 'GET' && url.pathname === '/v1/printers') {
        writeJson(response, 200, await this.getPrinters())
        return
      }
      if (request.method === 'POST' && url.pathname === '/v1/print') {
        const body = await readJson(request)
        const result = await this.print(body)
        writeJson(response, result.success ? 200 : 422, result)
        return
      }
      if (request.method === 'POST' && url.pathname === '/v1/preview') {
        await this.preview(await readJson(request))
        writeJson(response, 200, { success: true })
        return
      }
      writeError(response, '接口不存在。', 404)
    } catch (error) {
      writeError(response, error)
    }
  }
}
