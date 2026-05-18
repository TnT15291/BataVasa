import { create } from 'zustand'
import type {
  Category,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@features/finance/types'
import * as svc from '@features/finance/services'
import { logger } from '@services/logger'

const PAGE_SIZE = 50

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type FinanceState = {
  transactions: Transaction[]
  categories: Category[]
  txState: LoadState
  catState: LoadState
  lastError: string | null
  txHasMore: boolean
  txLoadingMore: boolean

  loadCategories: () => Promise<void>
  loadTransactions: () => Promise<void>
  loadMoreTransactions: () => Promise<void>
  createTransaction: (input: CreateTransactionInput) => Promise<{ ok: boolean; error?: string }>
  updateTransaction: (input: UpdateTransactionInput) => Promise<{ ok: boolean; error?: string }>
  deleteTransaction: (id: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
  createCategory: (input: CreateCategoryInput) => Promise<{ ok: boolean; error?: string }>
  updateCategory: (input: UpdateCategoryInput) => Promise<{ ok: boolean; error?: string }>
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  categories: [],
  txState: 'idle',
  catState: 'idle',
  lastError: null,
  txHasMore: false,
  txLoadingMore: false,

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
    set({ txState: 'loading', txHasMore: false })
    const r = await svc.listTransactions({ limit: PAGE_SIZE, offset: 0 })
    if (r.ok) {
      set({ transactions: r.value, txState: 'ready', txHasMore: r.value.length === PAGE_SIZE })
    } else {
      logger.error('finance.store', 'loadTransactions failed', { code: r.error.code })
      set({ txState: 'error', lastError: r.error.message })
    }
  },

  async loadMoreTransactions() {
    const { txHasMore, txLoadingMore, transactions } = get()
    if (!txHasMore || txLoadingMore) return
    set({ txLoadingMore: true })
    const r = await svc.listTransactions({ limit: PAGE_SIZE, offset: transactions.length })
    if (r.ok) {
      set({
        transactions: [...transactions, ...r.value],
        txHasMore: r.value.length === PAGE_SIZE,
        txLoadingMore: false,
      })
    } else {
      logger.error('finance.store', 'loadMoreTransactions failed', { code: r.error.code })
      set({ txLoadingMore: false })
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

  async updateTransaction(input) {
    const r = await svc.updateTransaction(input)
    if (r.ok) {
      const updated = r.value
      set({
        transactions: get().transactions.map((t) => (t.id === updated.id ? updated : t)),
      })
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

  async createCategory(input) {
    const r = await svc.createCategory(input)
    if (r.ok) {
      set({ categories: [...get().categories, r.value] })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async updateCategory(input) {
    const r = await svc.updateCategory(input)
    if (r.ok) {
      const updated = r.value
      set({ categories: get().categories.map((c) => (c.id === updated.id ? updated : c)) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async deleteCategory(id) {
    const r = await svc.deleteCategory(id)
    if (r.ok) {
      set({ categories: get().categories.filter((c) => c.id !== id) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async wipeAll() {
    const r = await svc.wipeAllData()
    if (r.ok) {
      // Clear in-memory state; re-trigger load so system categories re-show
      set({ transactions: [], categories: [], catState: 'idle', txState: 'idle' })
      // Re-load categories so the system seed re-populates the cache
      await get().loadCategories()
      await get().loadTransactions()
      return { ok: true, deleted: r.value.deleted }
    }
    return { ok: false, error: r.error.message }
  },
}))
