import 'react-native-gesture-handler'
import * as WebBrowser from 'expo-web-browser'

WebBrowser.maybeCompleteAuthSession()
import * as Sentry from '@sentry/react-native'
import { useEffect, useRef, useState } from 'react'
import { AppState, View, Text, ActivityIndicator, StyleSheet, LogBox } from 'react-native'
import { Stack } from 'expo-router'
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
import { UpdatePasswordScreen } from '@features/auth/UpdatePasswordScreen'
import { usePasswordRecoveryLink } from '@features/auth/usePasswordRecoveryLink'
import { useGoogleAuthCallback } from '@features/auth/useGoogleAuthCallback'
import { startSyncWorker, drainQueue } from '@services/sync'
import { BiometricLockScreen } from '@/components/BiometricLockScreen'
import { ToastHost } from '@/components/Toast'

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
  })
}

if (__DEV__) {
  LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications',
    '`expo-notifications` functionality is not fully supported in Expo Go',
  ])
}


const LOCK_TIMEOUT_MS = 30_000

export default function RootLayout() {
  const theme = useTheme()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  const session = useAuthStore((s) => s.session)
  const recoveryMode = useAuthStore((s) => s.recoveryMode)
  const { t } = useTranslation()

  // Handle `batavasa://reset-password` deep links from recovery emails.
  usePasswordRecoveryLink()
  useGoogleAuthCallback()
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
        <Text style={{ color: theme.text.danger, fontWeight: '600', marginBottom: 8 }}>{t.error_database_init_failed}</Text>
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
        <>
        {recoveryMode ? (
          <UpdatePasswordScreen />
        ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg.elevated },
            headerTitleStyle: { color: theme.text.primary, fontWeight: '600' },
            contentStyle: { backgroundColor: theme.bg.primary },
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen
            name="new"
            options={{
              title: t.nav_new_transaction,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="reminder"
            options={{
              title: t.new_reminder,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="journal"
            options={{
              title: t.new_journal,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="habit"
            options={{
              title: t.new_habit,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen name="settings" options={{ title: t.nav_settings }} />
          <Stack.Screen name="help" options={{ title: t.help_title }} />
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
          <Stack.Screen name="display-currency" options={{ title: t.display_currency }} />
          <Stack.Screen name="analysis" options={{ title: t.analysis_title }} />
          <Stack.Screen name="habits-report" options={{ title: t.habits_report_title }} />
          <Stack.Screen name="journals-report" options={{ title: t.journals_report_title }} />
          <Stack.Screen name="reminders-report" options={{ title: t.reminders_report_title }} />
          <Stack.Screen name="habits-insights" options={{ title: t.habit_insight_title }} />
          <Stack.Screen name="journals-insights" options={{ title: t.journal_reflection_title }} />
          <Stack.Screen name="reminders-insights" options={{ title: t.reminder_insight_title }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: 'none' }} />
        </Stack>
        )}
        {/* Auth gate: overlay covers the Stack while unauthenticated so routing
            still works for deep links (e.g. batavasa://auth/callback on Android). */}
        {!recoveryMode && !session && (
          <View style={StyleSheet.absoluteFill}>
            <AuthScreen />
          </View>
        )}
        <ToastHost />
        </>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
