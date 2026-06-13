import { DebtListScreen } from '@features/finance/screens/DebtListScreen'
import { useTranslation } from '@services/i18n'
import { Stack } from 'expo-router'

export default function Debts() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t.debt_book }} />
      <DebtListScreen />
    </>
  )
}
