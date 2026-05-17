import 'react-native-gesture-handler'
import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { runMigrations } from '@db/core/migrate'
import { useTheme } from '@design/useTheme'
import { useSettingsStore } from '@store/settingsStore'
import { useTranslation } from '@services/i18n'

function SettingsButton() {
  const router = useRouter()
  const theme = useTheme()
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={8}
      style={{ paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 22, color: theme.text.secondary }}>⚙️</Text>
    </Pressable>
  )
}

export default function RootLayout() {
  const theme = useTheme()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    runMigrations()
      .then(() => loadSettings())
      .then(() => setReady(true))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg.primary, padding: 24 }}>
        <Text style={{ color: theme.text.danger, fontWeight: '600', marginBottom: 8 }}>Database init failed</Text>
        <Text style={{ color: theme.text.muted, textAlign: 'center' }}>{error}</Text>
      </View>
    )
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg.primary }}>
        <ActivityIndicator color={theme.brand.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg.elevated },
            headerTitleStyle: { color: theme.text.primary, fontWeight: '600' },
            contentStyle: { backgroundColor: theme.bg.primary },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: t.nav_finance,
              headerRight: () => <SettingsButton />,
            }}
          />
          <Stack.Screen
            name="new"
            options={{ title: t.nav_new_transaction, presentation: 'modal' }}
          />
          <Stack.Screen name="settings" options={{ title: t.nav_settings }} />
          <Stack.Screen name="appearance" options={{ title: t.nav_appearance }} />
          <Stack.Screen name="language" options={{ title: t.nav_language }} />
          <Stack.Screen name="ai-settings" options={{ title: t.nav_ai_settings }} />
          <Stack.Screen name="currency" options={{ title: t.nav_currency }} />
          <Stack.Screen name="insights" options={{ title: t.nav_insights }} />
          <Stack.Screen name="reports" options={{ title: t.nav_reports }} />
          <Stack.Screen name="chat" options={{ title: t.nav_chat }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
