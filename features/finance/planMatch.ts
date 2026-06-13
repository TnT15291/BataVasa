import { Alert } from 'react-native'
import { useFinanceStore } from '@store/financeStore'
import { useSettingsStore } from '@store/settingsStore'
import { toast } from '@store/toastStore'
import type { Translations } from '@services/i18n/translations/vi'
import { findMatchingPlanItem, formatAmount } from './services'
import type { Transaction } from './types'

/**
 * After a transaction is saved, check whether it looks like an item in the
 * monthly plan and ask the user to confirm (Cross-Module Rule 5 — never
 * settle silently). Confirming links the transaction, which settles the
 * plan item for this cycle, so the unspent remainder (planned − actual)
 * flows back into safe-to-spend. Declining is remembered so the heuristic
 * never auto-settles this transaction later.
 */
export async function maybeConfirmPlanItemMatch(tx: Transaction, t: Translations): Promise<void> {
  const finance = useFinanceStore.getState()
  if (finance.planState === 'idle') await finance.loadPlanItems()
  const { planItems, transactions } = useFinanceStore.getState()
  if (planItems.length === 0) return

  const settings = useSettingsStore.getState()
  const item = findMatchingPlanItem({
    transaction: tx,
    planItems,
    transactions,
    cycleStartDay: settings.financeCycleStartDay,
  })
  if (!item) return

  const planAmount = formatAmount(item.amount_cents, item.currency, settings.language)
  const confirmed = await new Promise<boolean | null>((resolve) => {
    Alert.alert(
      t.plan_match_title,
      t.plan_match_message.replace('{{name}}', item.name).replace('{{amount}}', planAmount),
      [
        { text: t.plan_match_no, style: 'cancel', onPress: () => resolve(false) },
        { text: t.plan_match_yes, onPress: () => resolve(true) },
      ],
      // Backdrop dismiss = no answer; leave the transaction undecided so the
      // existing settle heuristic keeps working exactly as before.
      { cancelable: true, onDismiss: () => resolve(null) }
    )
  })
  if (confirmed === null) return

  const result = confirmed
    ? await useFinanceStore.getState().linkTransactionToPlanItem(tx.id, item.id)
    : await useFinanceStore.getState().dismissPlanItemMatch(tx.id)
  if (!result.ok) {
    toast.error(t.could_not_save, result.error)
    return
  }
  if (confirmed) {
    const leftover = item.amount_cents - Math.abs(tx.amount_cents)
    toast.success(
      t.plan_match_settled_toast,
      leftover > 0
        ? t.plan_match_leftover_toast.replace(
            '{{amount}}',
            formatAmount(leftover, item.currency, settings.language)
          )
        : undefined
    )
  }
}
