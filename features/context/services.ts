import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import { enqueue } from '@db/sync/queue'
import * as q from '@db/context/queries'
import {
  CreateContextInputSchema,
  UpdateContextInputSchema,
  type CreateContextInput,
  type UpdateContextInput,
  type UserContextEntry,
} from './types'

const MODULE = 'context.service'

export async function loadContext(): Promise<Result<UserContextEntry[], AppError>> {
  try {
    return ok(await q.listContext(getCurrentUserId()))
  } catch (e) {
    logger.error(MODULE, 'loadContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load AI memory', e)
  }
}

export async function createContext(input: CreateContextInput): Promise<Result<UserContextEntry, AppError>> {
  const parsed = CreateContextInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const ts = nowIso()
    const entry: UserContextEntry = {
      id: uuid(),
      user_id: getCurrentUserId(),
      kind: data.kind,
      content: data.content,
      pinned: data.pinned ? 1 : 0,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertContext(entry)
    void enqueue('user_context', entry.id, 'upsert')
    logger.info(MODULE, 'context created', { id: entry.id })
    return ok(entry)
  } catch (e) {
    logger.error(MODULE, 'createContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to save AI memory', e)
  }
}

export async function updateContext(input: UpdateContextInput): Promise<Result<UserContextEntry, AppError>> {
  const parsed = UpdateContextInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getContext(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Memory not found')
    const patch: Partial<UserContextEntry> = { updated_at: nowIso() }
    if (data.kind !== undefined) patch.kind = data.kind
    if (data.content !== undefined) patch.content = data.content
    if (data.pinned !== undefined) patch.pinned = data.pinned ? 1 : 0
    await q.updateContext(data.id, patch)
    void enqueue('user_context', data.id, 'upsert')
    const fresh = await q.getContext(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated memory vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update AI memory', e)
  }
}

export async function deleteContext(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getContext(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Memory not found')
    await q.softDeleteContext(id, nowIso())
    void enqueue('user_context', id, 'upsert')
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete AI memory', e)
  }
}

export async function wipeAllContext(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const deleted = await q.wipeContext(getCurrentUserId())
    void enqueue('user_context', 'ALL', 'wipe')
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe AI memory', e)
  }
}

export async function exportAllContext(): Promise<Result<string, AppError>> {
  try {
    const entries = await q.exportContextData(getCurrentUserId())
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), user_context: entries }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllContext failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export AI memory', e)
  }
}
