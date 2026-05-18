import { CategoryListScreen } from '@features/finance/screens/CategoryListScreen'
import { useTranslation } from '@services/i18n'
import { Stack } from 'expo-router'

export default function Categories() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t.nav_categories }} />
      <CategoryListScreen />
    </>
  )
}
