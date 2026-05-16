import * as SQLite from 'expo-sqlite'
import { logger } from '@services/logger'

const DB_NAME = 'batavasa.db'

let dbInstance: SQLite.SQLiteDatabase | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME)
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;')
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;')
  logger.info('db', 'opened', { name: DB_NAME })
  return dbInstance
}

export async function closeDb(): Promise<void> {
  if (!dbInstance) return
  await dbInstance.closeAsync()
  dbInstance = null
}

export function nowIso(): string {
  return new Date().toISOString()
}
