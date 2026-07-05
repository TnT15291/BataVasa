import { exportAllData } from '@features/finance/services'
import { exportAllHabits } from '@features/habits/services'
import { exportAllJournals } from '@features/journals/services'
import { exportAllReminders } from '@features/reminders/services'
import { exportAllGoals } from '@features/goals/services'
import { exportAllContext } from '@features/context/services'
import { appErr, ok, type AppError, type Result } from '@services/result'
import { logger } from '@services/logger'

const MODULE = 'backup.service'
const BACKUP_VERSION = 1

type ExportModuleKey = 'finance' | 'habits' | 'journals' | 'reminders' | 'goals' | 'user_context'

export type BackupPayload = {
  app: 'BataVasa'
  version: number
  created_at: string
  modules: Record<ExportModuleKey, unknown>
}

export type BackupFile = {
  fileName: string
  json: string
  recordCount: number
}

function parseExport(json: string): unknown {
  const payload = JSON.parse(json) as Record<string, unknown>
  const { exported_at: _exportedAt, ...data } = payload
  return data
}

function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (!value || typeof value !== 'object') return 0
  return Object.values(value).reduce((total, child) => total + countItems(child), 0)
}

function backupFileName(createdAt: string): string {
  const stamp = createdAt.replace(/[:.]/g, '-')
  return `batavasa-backup-${stamp}.json`
}

export async function createBackupFile(): Promise<Result<BackupFile, AppError>> {
  try {
    const [finance, habits, journals, reminders, goals, context] = await Promise.all([
      exportAllData(),
      exportAllHabits(),
      exportAllJournals(),
      exportAllReminders(),
      exportAllGoals(),
      exportAllContext(),
    ])
    const failed = [finance, habits, journals, reminders, goals, context].find((result) => !result.ok)
    if (failed && !failed.ok) return appErr(failed.error.code, failed.error.message, failed.error.cause)

    if (!finance.ok || !habits.ok || !journals.ok || !reminders.ok || !goals.ok || !context.ok) {
      return appErr('INTERNAL', 'Failed to create backup')
    }

    const createdAt = new Date().toISOString()
    const payload: BackupPayload = {
      app: 'BataVasa',
      version: BACKUP_VERSION,
      created_at: createdAt,
      modules: {
        finance: parseExport(finance.value),
        habits: parseExport(habits.value),
        journals: parseExport(journals.value),
        reminders: parseExport(reminders.value),
        goals: parseExport(goals.value),
        user_context: parseExport(context.value),
      },
    }
    const json = JSON.stringify(payload, null, 2)
    const recordCount = countItems(payload.modules)
    logger.info(MODULE, 'backup file created', { record_count: recordCount })
    return ok({ fileName: backupFileName(createdAt), json, recordCount })
  } catch (e) {
    logger.error(MODULE, 'createBackupFile failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create backup file', e)
  }
}
