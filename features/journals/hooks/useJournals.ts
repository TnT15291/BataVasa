import { useEffect } from 'react'
import { useJournalsStore } from '@store/journalsStore'

export function useJournalsBootstrap() {
  const loadState = useJournalsStore((s) => s.loadState)
  const loadJournals = useJournalsStore((s) => s.loadJournals)
  useEffect(() => {
    if (loadState === 'idle') loadJournals()
  }, [loadState, loadJournals])
  return loadState !== 'ready'
}

export function useJournals() {
  return useJournalsStore((s) => s.journals)
}

export function useJournalActions() {
  const createJournal = useJournalsStore((s) => s.createJournal)
  const updateJournal = useJournalsStore((s) => s.updateJournal)
  const deleteJournal = useJournalsStore((s) => s.deleteJournal)
  return { createJournal, updateJournal, deleteJournal }
}
