import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from '@services/i18n'
import { Stack } from 'expo-router'
import { JournalFormScreen } from '@features/journals/screens/JournalFormScreen'

export default function JournalRoute() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { t } = useTranslation()
  const title = params.id ? t.edit_journal : t.new_journal
  return (
    <>
      <Stack.Screen options={{ title }} />
      <JournalFormScreen />
    </>
  )
}
