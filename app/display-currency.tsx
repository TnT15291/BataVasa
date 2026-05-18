import { Stack } from 'expo-router'
import { DisplayCurrencyScreen } from '@features/settings/screens/DisplayCurrencyScreen'
import { useTranslation } from '@services/i18n'

export default function Page() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t.display_currency }} />
      <DisplayCurrencyScreen />
    </>
  )
}
