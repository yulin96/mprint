import type { MPrintAPI } from '../shared/print-types'

declare global {
  interface Window {
    api: MPrintAPI
  }
}
