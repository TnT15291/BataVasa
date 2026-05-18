import { useEffect } from 'react'
import { useFinanceStore } from '@store/financeStore'

/** Triggers bootstrap and returns true while categories or transactions are still loading. */
export function useFinanceBootstrap(): boolean {
  const loadCategories = useFinanceStore((s) => s.loadCategories)
  const loadTransactions = useFinanceStore((s) => s.loadTransactions)
  const catState = useFinanceStore((s) => s.catState)
  const txState = useFinanceStore((s) => s.txState)

  useEffect(() => {
    if (catState === 'idle') loadCategories()
    if (txState === 'idle') loadTransactions()
  }, [catState, txState, loadCategories, loadTransactions])

  return catState !== 'ready' || txState !== 'ready'
}

export function useCategories() {
  return useFinanceStore((s) => s.categories)
}

export function useTransactions() {
  return useFinanceStore((s) => s.transactions)
}

export function useFinanceActions() {
  const create = useFinanceStore((s) => s.createTransaction)
  const update = useFinanceStore((s) => s.updateTransaction)
  const remove = useFinanceStore((s) => s.deleteTransaction)
  const refresh = useFinanceStore((s) => s.loadTransactions)
  const loadMore = useFinanceStore((s) => s.loadMoreTransactions)
  const hasMore = useFinanceStore((s) => s.txHasMore)
  const loadingMore = useFinanceStore((s) => s.txLoadingMore)
  return { create, update, remove, refresh, loadMore, hasMore, loadingMore }
}

export function useCategoryActions() {
  const createCategory = useFinanceStore((s) => s.createCategory)
  const updateCategory = useFinanceStore((s) => s.updateCategory)
  const deleteCategory = useFinanceStore((s) => s.deleteCategory)
  return { createCategory, updateCategory, deleteCategory }
}
