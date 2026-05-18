import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from '@services/i18n'
import { Stack } from 'expo-router'
import { HabitFormScreen } from '@features/habits/screens/HabitFormScreen'

export default function HabitRoute() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { t } = useTranslation()
  const title = params.id ? t.edit_habit : t.new_habit
  return (
    <>
      <Stack.Screen options={{ title }} />
      <HabitFormScreen />
    </>
  )
}
