import { Stack } from 'expo-router'
import { ReminderListScreen } from '@features/reminders/screens/ReminderListScreen'
import { useTranslation } from '@services/i18n'

export default function Reminders() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t.nav_reminders }} />
      <ReminderListScreen />
    </>
  )
}
