import { Stack, useLocalSearchParams } from 'expo-router'
import { QuickAddScreen } from '@features/finance/screens/QuickAddScreen'
import { useTranslation } from '@services/i18n'

export default function New() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { t } = useTranslation()
  const title = params.id ? t.edit_transaction : t.nav_new_transaction
  return (
    <>
      <Stack.Screen options={{ title }} />
      <QuickAddScreen />
    </>
  )
}
