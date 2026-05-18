import { Stack, useLocalSearchParams } from 'expo-router'
import { ReminderFormScreen } from '@features/reminders/screens/ReminderFormScreen'
import { useTranslation } from '@services/i18n'

export default function Reminder() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string }>()
  const title = params.id ? t.edit_reminder : t.new_reminder
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ReminderFormScreen />
    </>
  )
}
