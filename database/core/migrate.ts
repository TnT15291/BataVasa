import { getDb } from './db'
import { initFinanceSchema } from '../finance/schema'
import { logger } from '@services/logger'

let migrationPromise: Promise<void> | null = null

export function runMigrations(): Promise<void> {
  if (migrationPromise) return migrationPromise
  migrationPromise = doMigrate()
  return migrationPromise
}

async function doMigrate(): Promise<void> {
  const db = await getDb()
  await initFinanceSchema(db)
  logger.info('migrate', 'all schemas initialized')
}
