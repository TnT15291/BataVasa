import * as WebBrowser from 'expo-web-browser'
import { View, ActivityIndicator } from 'react-native'
import { useTheme } from '@design/useTheme'

// Must be called in the component that renders when the OAuth redirect URL opens.
// On Android, Chrome Custom Tabs fire the deep link rather than returning to
// openAuthSessionAsync, so this closes any lingering browser session.
WebBrowser.maybeCompleteAuthSession()

export default function AuthCallback() {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg.primary }}>
      <ActivityIndicator color={theme.brand.primary} size="large" />
    </View>
  )
}
