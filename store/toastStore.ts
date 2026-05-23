import { create } from 'zustand'
import type { Translations } from '@services/i18n/translations/vi'

export type ToastKind = 'success' | 'error' | 'info'

type ToastState = {
  message: string | null
  detail?: string
  kind: ToastKind
  // Incremented on every show() so the host can re-trigger its animation
  // even when the same message is shown twice in a row.
  token: number
  show: (message: string, opts?: { detail?: string; kind?: ToastKind }) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  detail: undefined,
  kind: 'success',
  token: 0,
  show: (message, opts) =>
    set((s) => ({
      message,
      detail: opts?.detail,
      kind: opts?.kind ?? 'success',
      token: s.token + 1,
    })),
  hide: () => set({ message: null }),
}))

/**
 * Imperative helper so non-React code (services, save handlers) can show a
 * toast without wiring a hook. Mirrors the calm, low-friction feedback rule.
 */
export const toast = {
  success: (message: string, detail?: string) =>
    useToastStore.getState().show(message, { detail, kind: 'success' }),
  error: (message: string, detail?: string) =>
    useToastStore.getState().show(message, { detail, kind: 'error' }),
  info: (message: string, detail?: string) =>
    useToastStore.getState().show(message, { detail, kind: 'info' }),
}

/**
 * "Saved" feedback for entry-creating screens. Uses friendly, jargon-free
 * wording: when the module syncs to the cloud we promise auto-sync once
 * online; otherwise we reassure the data is safe on the device.
 */
export function notifySaved(t: Translations, synced: boolean) {
  toast.success(t.toast_saved, synced ? t.toast_synced_when_online : t.toast_saved_on_device)
}
