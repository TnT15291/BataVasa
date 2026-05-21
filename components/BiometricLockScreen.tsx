import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { authenticate, getBiometricSupport } from '@services/biometric'

type Props = {
  onUnlocked: () => void
}

export function BiometricLockScreen({ onUnlocked }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function tryAuthenticate() {
    setBusy(true)
    setFailed(false)
    const success = await authenticate(t.biometric_prompt, t.cancel)
    setBusy(false)
    if (success) {
      onUnlocked()
    } else {
      setFailed(true)
    }
  }

  useEffect(() => {
    void getBiometricSupport()
    void tryAuthenticate()
  }, [])

  const s = styles(theme)

  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name="shield-checkmark" size={56} color={theme.brand.primary} />
      </View>
      <Text style={s.appName}>BataVasa</Text>
      <Text style={s.subtitle}>{t.biometric_locked}</Text>

      {busy ? (
        <ActivityIndicator color={theme.brand.primary} style={{ marginTop: 32 }} />
      ) : (
        <Pressable
          onPress={tryAuthenticate}
          style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.buttonText}>
            {failed ? t.biometric_retry : t.biometric_unlock}
          </Text>
        </Pressable>
      )}

      {failed && (
        <Text style={s.errorText}>{t.biometric_failed}</Text>
      )}
    </View>
  )
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.primary,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.bg.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    appName: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.text.primary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.text.muted,
      textAlign: 'center',
      marginBottom: 8,
    },
    button: {
      marginTop: 32,
      backgroundColor: theme.brand.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    errorText: {
      marginTop: 12,
      fontSize: 13,
      color: theme.text.danger,
      textAlign: 'center',
    },
  })
}
