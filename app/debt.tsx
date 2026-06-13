import { DebtFormScreen } from '@features/finance/screens/DebtFormScreen'
import { useTranslation } from '@services/i18n'
import { useLocalSearchParams, Stack } from 'expo-router'

export default function Debt() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string }>()
  const title = params.id ? t.debt_edit : t.debt_new
  return (
    <>
      <Stack.Screen options={{ title }} />
      <DebtFormScreen />
    </>
  )
}
