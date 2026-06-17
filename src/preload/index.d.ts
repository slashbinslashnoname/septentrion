import type { SeptentrionApi } from './index'

declare global {
  interface Window {
    api: SeptentrionApi
  }
}

export {}
