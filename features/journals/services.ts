import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { nowIso } from '@db/core/db'
import * as q from '@db/journals/queries'
import {
  CreateJournalInputSchema,
  UpdateJournalInputSchema,
  type CreateJournalInput,
  type UpdateJournalInput,
  type Journal,
} from './types'

const MODULE = 'journals.service'

export async function createJournal(
  input: CreateJournalInput
): Promise<Result<Journal, AppError>> {
  const parsed = CreateJournalInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const journal: Journal = {
      id: uuid(),
      user_id: null,
      content: data.content,
      mood: data.mood ?? null,
      occurred_at: data.occurred_at,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_label: data.location_label ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertJournal(journal)
    logger.info(MODULE, 'journal created', { id: journal.id })
    return ok(journal)
  } catch (e) {
    logger.error(MODULE, 'createJournal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create journal entry', e)
  }
}

export async function updateJournal(
  input: UpdateJournalInput
): Promise<Result<Journal, AppError>> {
  const parsed = UpdateJournalInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const existing = await q.getJournal(data.id)
    if (!existing) return appErr('NOT_FOUND', 'Journal entry not found')

    const patch: Partial<Journal> = { updated_at: nowIso() }
    if (data.content !== undefined) patch.content = data.content
    if (data.mood !== undefined) patch.mood = data.mood
    if (data.occurred_at !== undefined) patch.occurred_at = data.occurred_at
    if (data.location_lat !== undefined) patch.location_lat = data.location_lat
    if (data.location_lng !== undefined) patch.location_lng = data.location_lng
    if (data.location_label !== undefined) patch.location_label = data.location_label

    await q.updateJournal(data.id, patch)

    const fresh = await q.getJournal(data.id)
    if (!fresh) return appErr('INTERNAL', 'Updated journal entry vanished')
    logger.info(MODULE, 'journal updated', { id: data.id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateJournal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update journal entry', e)
  }
}

export async function deleteJournal(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getJournal(id)
    if (!existing) return appErr('NOT_FOUND', 'Journal entry not found')

    await q.softDeleteJournal(id, nowIso())
    logger.info(MODULE, 'journal deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteJournal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete journal entry', e)
  }
}

export async function loadJournals(): Promise<Result<Journal[], AppError>> {
  try {
    const journals = await q.listJournals()
    return ok(journals)
  } catch (e) {
    logger.error(MODULE, 'loadJournals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load journal entries', e)
  }
}

export async function wipeAllJournals(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const deleted = await q.wipeJournals()
    logger.info(MODULE, 'wiped all journals', { deleted })
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllJournals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe journal entries', e)
  }
}

export async function exportAllJournals(): Promise<Result<string, AppError>> {
  try {
    const journals = await q.exportJournalsData()
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), journals }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllJournals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export journal entries', e)
  }
}
