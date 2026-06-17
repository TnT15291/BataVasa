import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useAuthStore } from '@store/authStore'
import { UpdatePasswordScreen } from '@features/auth/UpdatePasswordScreen'
import { BrandLogo } from '@components/BrandLogo'

// How long to show the "verifying…" spinner before assuming the recovery link
// could not be processed (missing/expired tokens). usePasswordRecoveryLink, in
// the root layout, parses the deep link and flips recoveryMode well before this.
const VERIFY_TIMEOUT_MS = 8000

/**
 * Landing route for `batavasa://reset-password` recovery links. Without a real
 * route file the deep link hits Expo Router's "Unmatched Route" dead-end. This
 * screen gives the link somewhere to land:
 *   - while the link is being verified → spinner
 *   - once recoveryMode is set → the set-new-password form
 *   - if the link is expired/invalid/never carried tokens → a clear message
 *     with a path back to sign in (never a dead-end)
 *
 * Token parsing itself stays in usePasswordRecoveryLink (root layout) so the
 * single-use recovery code is never exchanged twice; this screen only reflects
 * the resulting auth-store state.
 */
export default function ResetPasswordRoute() {
  const theme = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const recoveryMode = useAuthStore((s) => s.recoveryMode)
  const error = useAuthStore((s) => s.error)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (recoveryMode) return
    const id = setTimeout(() => setTimedOut(true), VERIFY_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [recoveryMode])

  // recoveryMode also drives a full-screen overlay in the root layout, so this
  // branch is belt-and-suspenders — the route stays correct on its own.
  if (recoveryMode) return <UpdatePasswordScreen />

  const failed = Boolean(error) || timedOut

  const backToSignIn = () => {
    void useAuthStore.getState().exitRecovery()
    router.replace('/')
  }

  return (
    <View style={[styles.center, { backgroundColor: theme.bg.primary }]}>
      <BrandLogo />
      {failed ? (
        <>
          <Text style={[styles.message, { color: theme.text.primary }]}>
            {error ?? t.auth_reset_link_invalid}
          </Text>
          <Pressable onPress={backToSignIn} style={[styles.cta, { backgroundColor: theme.brand.primary }]}>
            <Text style={styles.ctaText}>{t.auth_back_to_sign_in}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.brand.primary} style={{ marginTop: spacing[6] }} />
          <Text style={[styles.message, { color: theme.text.muted }]}>{t.auth_reset_verifying}</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  message: { fontSize: 15, textAlign: 'center', marginTop: spacing[5] },
  cta: { paddingVertical: spacing[4], paddingHorizontal: spacing[6], borderRadius: radius.md, marginTop: spacing[6] },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
