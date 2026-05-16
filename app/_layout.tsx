import 'react-native-gesture-handler'
import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { runMigrations } from '@db/core/migrate'
import { useTheme } from '@design/useTheme'

export default function RootLayout() {
  const theme = useTheme()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    runMigrations()
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
          <Stack.Screen name="index" options={{ title: 'Finance' }} />
          <Stack.Screen
            name="new"
            options={{ title: 'New Transaction', presentation: 'modal' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
