import { Stack } from 'expo-router'
import { TransactionListScreen } from '@features/finance/screens/TransactionListScreen'
import { useTranslation } from '@services/i18n'

export default function Finance() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t.nav_finance }} />
      <TransactionListScreen />
    </>
  )
}
