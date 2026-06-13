import { useEffect } from 'react'
import { useFinanceStore } from '@store/financeStore'

/** Triggers bootstrap and returns true while categories or transactions are still loading. */
export function useFinanceBootstrap(): boolean {
  const loadCategories = useFinanceStore((s) => s.loadCategories)
  const loadTransactions = useFinanceStore((s) => s.loadTransactions)
  const loadPlanItems = useFinanceStore((s) => s.loadPlanItems)
  const loadDebts = useFinanceStore((s) => s.loadDebts)
  const catState = useFinanceStore((s) => s.catState)
  const txState = useFinanceStore((s) => s.txState)
  const planState = useFinanceStore((s) => s.planState)
  const debtState = useFinanceStore((s) => s.debtState)

  useEffect(() => {
    if (catState === 'idle') loadCategories()
    if (txState === 'idle') loadTransactions()
    if (planState === 'idle') loadPlanItems()
    if (debtState === 'idle') loadDebts()
  }, [catState, txState, planState, debtState, loadCategories, loadTransactions, loadPlanItems, loadDebts])

  return catState !== 'ready' || txState !== 'ready' || planState !== 'ready'
}

export function useCategories() {
  return useFinanceStore((s) => s.categories)
}

export function useTransactions() {
  return useFinanceStore((s) => s.transactions)
}

export function usePlanItems() {
  return useFinanceStore((s) => s.planItems)
}

export function useFinanceActions() {
  const create = useFinanceStore((s) => s.createTransaction)
  const update = useFinanceStore((s) => s.updateTransaction)
  const remove = useFinanceStore((s) => s.deleteTransaction)
  const restore = useFinanceStore((s) => s.restoreTransaction)
  const refresh = useFinanceStore((s) => s.loadTransactions)
  const loadMore = useFinanceStore((s) => s.loadMoreTransactions)
  const hasMore = useFinanceStore((s) => s.txHasMore)
  const loadingMore = useFinanceStore((s) => s.txLoadingMore)
  return { create, update, remove, restore, refresh, loadMore, hasMore, loadingMore }
}

export function usePlanItemActions() {
  const createPlanItem = useFinanceStore((s) => s.createPlanItem)
  const updatePlanItem = useFinanceStore((s) => s.updatePlanItem)
  const deletePlanItem = useFinanceStore((s) => s.deletePlanItem)
  const restorePlanItem = useFinanceStore((s) => s.restorePlanItem)
  return { createPlanItem, updatePlanItem, deletePlanItem, restorePlanItem }
}

export function useDebts() {
  return useFinanceStore((s) => s.debts)
}

export function useDebtActions() {
  const createDebt = useFinanceStore((s) => s.createDebt)
  const updateDebt = useFinanceStore((s) => s.updateDebt)
  const settleDebt = useFinanceStore((s) => s.settleDebt)
  const deleteDebt = useFinanceStore((s) => s.deleteDebt)
  const restoreDebt = useFinanceStore((s) => s.restoreDebt)
  return { createDebt, updateDebt, settleDebt, deleteDebt, restoreDebt }
}

export function useCategoryActions() {
  const createCategory = useFinanceStore((s) => s.createCategory)
  const updateCategory = useFinanceStore((s) => s.updateCategory)
  const deleteCategory = useFinanceStore((s) => s.deleteCategory)
  return { createCategory, updateCategory, deleteCategory }
}
