import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ActivityIndicator, ScrollView, Modal,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation, LANGUAGES } from '@services/i18n'
import { useAuthStore } from '@store/authStore'
import { useSettingsStore } from '@store/settingsStore'
import { toast } from '@store/toastStore'
import { KeyboardAvoider } from '@components/KeyboardAvoider'

type Mode = 'signin' | 'signup'

/**
 * Language dropdown for the auth screen — a new user reaches this before any
 * Settings access, so they must be able to pick a readable language here.
 */
function LanguageCombo() {
  const theme = useTheme()
  const { language } = useTranslation()
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]!

  return (
    <View style={styles.comboWrap}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={current.nativeLabel}
        style={[styles.comboTrigger, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      >
        <Text style={styles.comboFlag}>{current.flag}</Text>
        <Text style={[styles.comboLabel, { color: theme.text.primary }]}>{current.nativeLabel}</Text>
        <Feather name="chevron-down" size={18} color={theme.text.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.comboOverlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.comboMenu, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
            onPress={() => {}}
          >
            {LANGUAGES.map((l) => {
              const active = l.code === language
              return (
                <Pressable
                  key={l.code}
                  onPress={() => { void setLanguage(l.code); setOpen(false) }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.comboItem,
                    { backgroundColor: pressed ? theme.bg.secondary : 'transparent' },
                  ]}
                >
                  <Text style={styles.comboFlag}>{l.flag}</Text>
                  <Text style={[styles.comboItemText, { color: active ? theme.brand.primary : theme.text.primary }]}>
                    {l.nativeLabel}
                  </Text>
                  {active ? <Feather name="check" size={18} color={theme.brand.primary} style={styles.comboCheck} /> : null}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

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
        <LanguageCombo />
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
      const r = await signIn(email, password)
      if (r.ok) toast.success(t.auth_signin_success, email.trim())
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
    <KeyboardAvoider style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <LanguageCombo />
        <Text style={[styles.logo, { color: theme.brand.primary }]}>BataVasa</Text>
        <Text style={[styles.tagline, { color: theme.text.secondary }]}>{t.auth_tagline}</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>
          {mode === 'signin' ? t.auth_subtitle_signin : t.auth_subtitle_signup}
        </Text>

        <View style={[styles.benefits, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {([
            { icon: 'cloud' as const, text: t.auth_benefit_sync },
            { icon: 'wifi-off' as const, text: t.auth_benefit_offline },
            { icon: 'lock' as const, text: t.auth_benefit_private },
          ]).map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <Feather name={b.icon} size={16} color={theme.brand.primary} />
              <Text style={[styles.benefitText, { color: theme.text.secondary }]}>{b.text}</Text>
            </View>
          ))}
        </View>

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
    </KeyboardAvoider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  body: { padding: spacing[6], paddingTop: spacing[8] * 1.5, gap: spacing[2], flexGrow: 1, justifyContent: 'center' },
  comboWrap: { alignSelf: 'stretch', alignItems: 'center', marginBottom: spacing[6] },
  comboTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
    paddingVertical: spacing[2],
    minWidth: 160,
  },
  comboFlag: { fontSize: 16 },
  comboLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  comboOverlay: { flex: 1, backgroundColor: '#00000055', alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  comboMenu: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[1],
    minWidth: 220,
    maxWidth: 320,
    overflow: 'hidden',
  },
  comboItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  comboItemText: { fontSize: 15 },
  comboCheck: { marginLeft: 'auto' },
  logo: { fontSize: 34, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  tagline: { fontSize: 14, textAlign: 'center', marginTop: spacing[2], lineHeight: 20 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: spacing[4], marginBottom: spacing[4] },
  benefits: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  benefitText: { fontSize: 13, flex: 1, lineHeight: 18 },
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
