import { CategoryFormScreen } from '@features/finance/screens/CategoryFormScreen'
import { useTranslation } from '@services/i18n'
import { useLocalSearchParams, Stack } from 'expo-router'

export default function Category() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string }>()
  const title = params.id ? t.edit_category : t.new_category
  return (
    <>
      <Stack.Screen options={{ title }} />
      <CategoryFormScreen />
    </>
  )
}
