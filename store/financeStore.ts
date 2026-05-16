import { create } from 'zustand'
import type { Category, Transaction, CreateTransactionInput } from '@features/finance/types'
import * as svc from '@features/finance/services'
import { logger } from '@services/logger'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type FinanceState = {
  transactions: Transaction[]
  categories: Category[]
  txState: LoadState
  catState: LoadState
  lastError: string | null

  loadCategories: () => Promise<void>
  loadTransactions: () => Promise<void>
  createTransaction: (input: CreateTransactionInput) => Promise<{ ok: boolean; error?: string }>
  deleteTransaction: (id: string) => Promise<{ ok: boolean; error?: string }>
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  categories: [],
  txState: 'idle',
  catState: 'idle',
  lastError: null,

  async loadCategories() {
    set({ catState: 'loading' })
    const r = await svc.listCategories()
    if (r.ok) {
      set({ categories: r.value, catState: 'ready' })
    } else {
      logger.error('finance.store', 'loadCategories failed', { code: r.error.code })
      set({ catState: 'error', lastError: r.error.message })
    }
  },

  async loadTransactions() {
    set({ txState: 'loading' })
    const r = await svc.listTransactions()
    if (r.ok) {
      set({ transactions: r.value, txState: 'ready' })
    } else {
      logger.error('finance.store', 'loadTransactions failed', { code: r.error.code })
      set({ txState: 'error', lastError: r.error.message })
    }
  },

  async createTransaction(input) {
    const r = await svc.createTransaction(input)
    if (r.ok) {
      set({ transactions: [r.value, ...get().transactions] })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async deleteTransaction(id) {
    const r = await svc.deleteTransaction(id)
    if (r.ok) {
      set({ transactions: get().transactions.filter((t) => t.id !== id) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },
}))
