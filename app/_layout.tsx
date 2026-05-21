import 'react-native-gesture-handler'
import * as Sentry from '@sentry/react-native'
import { useEffect, useRef, useState } from 'react'
import { AppState, View, Text, ActivityIndicator, Pressable } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { runMigrations } from '@db/core/migrate'
import { useTheme } from '@design/useTheme'
import { useSettingsStore } from '@store/settingsStore'
import { useTranslation } from '@services/i18n'
import { track } from '@services/analytics'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuthStore } from '@store/authStore'
import { AuthScreen } from '@features/auth/AuthScreen'
import { startSyncWorker, drainQueue } from '@services/sync'
import { BiometricLockScreen } from '@/components/BiometricLockScreen'

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
  })
}

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

const LOCK_TIMEOUT_MS = 30_000

export default function RootLayout() {
  const theme = useTheme()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  const session = useAuthStore((s) => s.session)
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const backgroundedAt = useRef<number | null>(null)

  useEffect(() => {
    let stopSync: (() => void) | undefined
    runMigrations()
      .then(() => loadSettings())
      .then(() => useAuthStore.getState().init())
      .then(() => { stopSync = startSyncWorker() })
      .then(() => setReady(true))
      .catch((e) => setError(String(e)))
    return () => stopSync?.()
  }, [])

  useEffect(() => {
    if (session) void drainQueue()
  }, [session])

  useEffect(() => {
    if (!ready) return
    track('app_open')

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        track('app_background')
        backgroundedAt.current = Date.now()
      } else if (state === 'active') {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
        if (biometricLock && session && elapsed > LOCK_TIMEOUT_MS) {
          setLocked(true)
        }
        backgroundedAt.current = null
      }
    })
    return () => sub.remove()
  }, [ready, biometricLock, session])

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

  if (locked) {
    return <BiometricLockScreen onUnlocked={() => setLocked(false)} />
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
        {session ? (
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
              title: 'BataVasa',
              headerRight: () => <SettingsButton />,
            }}
          />
          <Stack.Screen
            name="new"
            options={{ title: t.nav_new_transaction, presentation: 'modal' }}
          />
          <Stack.Screen name="settings" options={{ title: t.nav_settings }} />
          <Stack.Screen name="data-management" options={{ title: t.data_management }} />
          <Stack.Screen name="appearance" options={{ title: t.nav_appearance }} />
          <Stack.Screen name="language" options={{ title: t.nav_language }} />
          <Stack.Screen name="ai-settings" options={{ title: t.nav_ai_settings }} />
          <Stack.Screen name="currency" options={{ title: t.nav_currency }} />
          <Stack.Screen name="insights" options={{ title: t.nav_insights }} />
          <Stack.Screen name="reports" options={{ title: t.nav_reports }} />
          <Stack.Screen name="chat" options={{ title: t.nav_chat }} />
          <Stack.Screen name="categories" options={{ title: t.nav_categories }} />
          <Stack.Screen name="category" options={{ title: t.new_category }} />
          <Stack.Screen name="reminders" options={{ title: t.nav_reminders }} />
          <Stack.Screen name="reminder" options={{ title: t.new_reminder }} />
          <Stack.Screen name="finance" options={{ title: t.nav_finance }} />
          <Stack.Screen name="journals" options={{ title: t.journals }} />
          <Stack.Screen name="journal" options={{ title: t.new_journal }} />
          <Stack.Screen name="habits" options={{ title: t.habits }} />
          <Stack.Screen name="habit" options={{ title: t.new_habit }} />
          <Stack.Screen name="display-currency" options={{ title: t.display_currency }} />
          <Stack.Screen name="analysis" options={{ title: t.analysis_title }} />
          <Stack.Screen name="habits-report" options={{ title: t.habits_report_title }} />
          <Stack.Screen name="journals-report" options={{ title: t.journals_report_title }} />
          <Stack.Screen name="reminders-report" options={{ title: t.reminders_report_title }} />
        </Stack>
        ) : (
          <AuthScreen />
        )}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
