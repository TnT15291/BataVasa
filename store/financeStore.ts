import { create } from 'zustand'
import type {
  Category,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  PlanItem,
  CreatePlanItemInput,
  UpdatePlanItemInput,
  Debt,
  CreateDebtInput,
  UpdateDebtInput,
} from '@features/finance/types'
import * as svc from '@features/finance/services'
import type { DebtLabels } from '@features/finance/services'
import { logger } from '@services/logger'

const PAGE_SIZE = 50

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type FinanceState = {
  transactions: Transaction[]
  categories: Category[]
  planItems: PlanItem[]
  debts: Debt[]
  txState: LoadState
  catState: LoadState
  planState: LoadState
  debtState: LoadState
  lastError: string | null
  txHasMore: boolean
  txLoadingMore: boolean

  loadCategories: () => Promise<void>
  loadTransactions: () => Promise<void>
  loadPlanItems: () => Promise<void>
  loadDebts: () => Promise<void>
  loadMoreTransactions: () => Promise<void>
  createTransaction: (input: CreateTransactionInput) => Promise<{ ok: boolean; error?: string; tx?: Transaction }>
  updateTransaction: (input: UpdateTransactionInput) => Promise<{ ok: boolean; error?: string }>
  deleteTransaction: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreTransaction: (id: string) => Promise<{ ok: boolean; error?: string }>
  linkTransactionToPlanItem: (txId: string, planItemId: string) => Promise<{ ok: boolean; error?: string }>
  dismissPlanItemMatch: (txId: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
  createCategory: (input: CreateCategoryInput) => Promise<{ ok: boolean; error?: string }>
  updateCategory: (input: UpdateCategoryInput) => Promise<{ ok: boolean; error?: string }>
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>
  createPlanItem: (input: CreatePlanItemInput) => Promise<{ ok: boolean; error?: string }>
  updatePlanItem: (input: UpdatePlanItemInput) => Promise<{ ok: boolean; error?: string }>
  deletePlanItem: (id: string) => Promise<{ ok: boolean; error?: string }>
  restorePlanItem: (id: string) => Promise<{ ok: boolean; error?: string }>
  createDebt: (input: CreateDebtInput, labels?: DebtLabels) => Promise<{ ok: boolean; error?: string; debt?: Debt }>
  updateDebt: (input: UpdateDebtInput, labels?: DebtLabels) => Promise<{ ok: boolean; error?: string }>
  settleDebt: (id: string, labels?: DebtLabels) => Promise<{ ok: boolean; error?: string }>
  deleteDebt: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreDebt: (id: string) => Promise<{ ok: boolean; error?: string }>
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  categories: [],
  planItems: [],
  debts: [],
  txState: 'idle',
  catState: 'idle',
  planState: 'idle',
  debtState: 'idle',
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

  async loadPlanItems() {
    set({ planState: 'loading' })
    const r = await svc.listPlanItems()
    if (r.ok) {
      set({ planItems: r.value, planState: 'ready' })
    } else {
      logger.error('finance.store', 'loadPlanItems failed', { code: r.error.code })
      set({ planState: 'error', lastError: r.error.message })
    }
  },

  async loadDebts() {
    set({ debtState: 'loading' })
    const r = await svc.listDebts()
    if (r.ok) {
      set({ debts: r.value, debtState: 'ready' })
    } else {
      logger.error('finance.store', 'loadDebts failed', { code: r.error.code })
      set({ debtState: 'error', lastError: r.error.message })
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
      return { ok: true, tx: r.value }
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

  async restoreTransaction(id) {
    const r = await svc.restoreTransaction(id)
    if (r.ok) {
      set({ transactions: [r.value, ...get().transactions].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async linkTransactionToPlanItem(txId, planItemId) {
    const r = await svc.linkTransactionToPlanItem(txId, planItemId)
    if (r.ok) {
      const updated = r.value
      set({ transactions: get().transactions.map((t) => (t.id === updated.id ? updated : t)) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async dismissPlanItemMatch(txId) {
    const r = await svc.dismissPlanItemMatch(txId)
    if (r.ok) {
      const updated = r.value
      set({ transactions: get().transactions.map((t) => (t.id === updated.id ? updated : t)) })
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

  async createPlanItem(input) {
    const r = await svc.createPlanItem(input)
    if (r.ok) {
      set({ planItems: [...get().planItems, r.value] })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async updatePlanItem(input) {
    const r = await svc.updatePlanItem(input)
    if (r.ok) {
      const updated = r.value
      set({ planItems: get().planItems.map((p) => (p.id === updated.id ? updated : p)) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async deletePlanItem(id) {
    const r = await svc.deletePlanItem(id)
    if (r.ok) {
      set({ planItems: get().planItems.filter((p) => p.id !== id) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async restorePlanItem(id) {
    const r = await svc.restorePlanItem(id)
    if (r.ok) {
      set({ planItems: [...get().planItems, r.value].sort((a, b) => a.kind.localeCompare(b.kind) || a.due_day - b.due_day || a.name.localeCompare(b.name)) })
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async createDebt(input, labels) {
    const r = await svc.createDebt(input, labels)
    if (r.ok) {
      set({ debts: [r.value, ...get().debts] })
      // The debt recorded a transaction too — refresh so totals stay honest.
      await get().loadTransactions()
      return { ok: true, debt: r.value }
    }
    return { ok: false, error: r.error.message }
  },

  async updateDebt(input, labels) {
    const r = await svc.updateDebt(input, labels)
    if (r.ok) {
      const updated = r.value
      set({ debts: get().debts.map((d) => (d.id === updated.id ? updated : d)) })
      await get().loadTransactions()
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async settleDebt(id, labels) {
    const r = await svc.settleDebt(id, labels)
    if (r.ok) {
      const updated = r.value
      set({ debts: get().debts.map((d) => (d.id === updated.id ? updated : d)) })
      await get().loadTransactions()
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async deleteDebt(id) {
    const r = await svc.deleteDebt(id)
    if (r.ok) {
      set({ debts: get().debts.filter((d) => d.id !== id) })
      await get().loadTransactions()
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async restoreDebt(id) {
    const r = await svc.restoreDebt(id)
    if (r.ok) {
      set({ debts: [r.value, ...get().debts] })
      await get().loadTransactions()
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async wipeAll() {
    const r = await svc.wipeAllData()
    if (r.ok) {
      // Clear in-memory state; re-trigger load so system categories re-show
      set({ transactions: [], categories: [], planItems: [], debts: [], catState: 'idle', txState: 'idle', planState: 'idle', debtState: 'idle' })
      // Re-load categories so the system seed re-populates the cache
      await get().loadCategories()
      await get().loadTransactions()
      await get().loadPlanItems()
      await get().loadDebts()
      return { ok: true, deleted: r.value.deleted }
    }
    return { ok: false, error: r.error.message }
  },
}))
