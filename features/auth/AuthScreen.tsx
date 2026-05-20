import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useAuthStore } from '@store/authStore'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const configured = useAuthStore((s) => s.configured)
  const busy = useAuthStore((s) => s.busy)
  const error = useAuthStore((s) => s.error)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmMsg, setConfirmMsg] = useState(false)

  // Backend not configured → friendly notice, never a white screen.
  if (!configured) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg.primary }]}>
        <Text style={[styles.logo, { color: theme.brand.primary }]}>BataVasa</Text>
        <Text style={[styles.title, { color: theme.text.primary, marginTop: spacing[4] }]}>
          {t.auth_not_configured_title}
        </Text>
        <Text style={[styles.body, { color: theme.text.muted }]}>
          {t.auth_not_configured_body}
        </Text>
        <Text style={[styles.code, { color: theme.text.secondary, borderColor: theme.border.subtle }]}>
          docs/auth-setup.md
        </Text>
      </View>
    )
  }

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy

  const onSubmit = async () => {
    if (!canSubmit) return
    setConfirmMsg(false)
    if (mode === 'signin') {
      await signIn(email, password)
    } else {
      const r = await signUp(email, password)
      if (r.ok && r.needsConfirm) setConfirmMsg(true)
    }
  }

  const toggleMode = () => {
    clearError()
    setConfirmMsg(false)
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.logo, { color: theme.brand.primary }]}>BataVasa</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>
          {mode === 'signin' ? t.auth_subtitle_signin : t.auth_subtitle_signup}
        </Text>

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.auth_email}</Text>
        <TextInput
          value={email}
          onChangeText={(v) => { setEmail(v); if (error) clearError() }}
          placeholder={t.auth_email_ph}
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.auth_password}</Text>
        <TextInput
          value={password}
          onChangeText={(v) => { setPassword(v); if (error) clearError() }}
          placeholder={t.auth_password_ph}
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          secureTextEntry
          onSubmitEditing={onSubmit}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        {error && <Text style={[styles.error, { color: theme.semantic.danger }]}>{error}</Text>}
        {confirmMsg && <Text style={[styles.confirm, { color: theme.semantic.success }]}>{t.auth_check_email}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.cta, { backgroundColor: canSubmit ? theme.brand.primary : theme.text.muted }]}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaText}>{mode === 'signin' ? t.auth_signin_cta : t.auth_signup_cta}</Text>}
        </Pressable>

        <Pressable onPress={toggleMode} style={styles.toggle} hitSlop={8}>
          <Text style={[styles.toggleText, { color: theme.brand.primary }]}>
            {mode === 'signin' ? t.auth_toggle_to_signup : t.auth_toggle_to_signin}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  body: { padding: spacing[6], paddingTop: spacing[8] * 1.5, gap: spacing[2], flexGrow: 1, justifyContent: 'center' },
  logo: { fontSize: 34, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: spacing[6] },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[2] },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  error: { fontSize: 13, marginTop: spacing[2] },
  confirm: { fontSize: 13, marginTop: spacing[2] },
  cta: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[5] },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggle: { alignItems: 'center', paddingVertical: spacing[4] },
  toggleText: { fontSize: 14, fontWeight: '500' },
  code: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: spacing[5], borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
})
