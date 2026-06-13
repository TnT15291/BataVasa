import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useAuthStore } from '@store/authStore'
import { toast } from '@store/toastStore'
import { KeyboardAvoider } from '@components/KeyboardAvoider'
import { BrandLogo } from '@components/BrandLogo'

/**
 * Shown when a password-recovery deep link put the store into `recoveryMode`
 * (see usePasswordRecoveryLink + authStore.enterRecovery). The user already
 * holds a temporary session; they MUST set a new password before reaching the
 * app. Backing out signs them out (authStore.exitRecovery).
 */
export function UpdatePasswordScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const busy = useAuthStore((s) => s.busy)
  const error = useAuthStore((s) => s.error)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const exitRecovery = useAuthStore((s) => s.exitRecovery)
  const clearError = useAuthStore((s) => s.clearError)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const longEnough = password.length >= 6
  const canSubmit = longEnough && confirm.length >= 6 && !busy

  const onSubmit = async () => {
    if (!canSubmit) return
    if (password !== confirm) {
      setLocalError(t.auth_password_mismatch)
      return
    }
    setLocalError(null)
    const r = await updatePassword(password)
    if (r.ok) toast.success(t.auth_password_updated)
  }

  const onChange = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    if (localError) setLocalError(null)
    if (error) clearError()
  }

  return (
    <KeyboardAvoider style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <BrandLogo />
        <Text style={[styles.title, { color: theme.text.primary }]}>{t.auth_update_password_title}</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>{t.auth_update_password_subtitle}</Text>

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.auth_new_password}</Text>
        <TextInput
          value={password}
          onChangeText={onChange(setPassword)}
          placeholder={t.auth_new_password_ph}
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          autoComplete="password-new"
          secureTextEntry
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.auth_confirm_password}</Text>
        <TextInput
          value={confirm}
          onChangeText={onChange(setConfirm)}
          placeholder={t.auth_confirm_password_ph}
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          autoComplete="password-new"
          secureTextEntry
          onSubmitEditing={onSubmit}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        {(localError || error) && (
          <Text style={[styles.error, { color: theme.semantic.danger }]}>{localError ?? error}</Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.cta, { backgroundColor: canSubmit ? theme.brand.primary : theme.text.muted }]}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaText}>{t.auth_update_password_cta}</Text>}
        </Pressable>

        <Pressable onPress={() => { void exitRecovery() }} disabled={busy} style={styles.cancel} hitSlop={8}>
          <Text style={[styles.cancelText, { color: theme.text.muted }]}>{t.auth_recovery_cancel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoider>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[6], paddingTop: spacing[8] * 1.5, gap: spacing[2], flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: spacing[5] },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: spacing[2], marginBottom: spacing[5] },
  label: { fontSize: 12, fontWeight: '600', marginTop: spacing[2] },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  error: { fontSize: 13, marginTop: spacing[2] },
  cta: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[5] },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: spacing[4] },
  cancelText: { fontSize: 14, fontWeight: '500' },
})
