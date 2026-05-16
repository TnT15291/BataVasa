import { useEffect } from 'react'
import { useFinanceStore } from '@store/financeStore'

export function useFinanceBootstrap() {
  const loadCategories = useFinanceStore((s) => s.loadCategories)
  const loadTransactions = useFinanceStore((s) => s.loadTransactions)
  const catState = useFinanceStore((s) => s.catState)
  const txState = useFinanceStore((s) => s.txState)

  useEffect(() => {
    if (catState === 'idle') loadCategories()
    if (txState === 'idle') loadTransactions()
  }, [catState, txState, loadCategories, loadTransactions])
}

export function useCategories() {
  return useFinanceStore((s) => s.categories)
}

export function useTransactions() {
  return useFinanceStore((s) => s.transactions)
}

export function useFinanceActions() {
  const create = useFinanceStore((s) => s.createTransaction)
  const remove = useFinanceStore((s) => s.deleteTransaction)
  const refresh = useFinanceStore((s) => s.loadTransactions)
  return { create, remove, refresh }
}
