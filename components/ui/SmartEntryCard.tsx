import type { ReactNode } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { spacing, radius } from '@design/tokens'
import { Card } from './Card'
import { VoiceButton } from '@components/VoiceButton'

type Props = {
  value: string
  onChangeText: (text: string) => void
  /** Run the parse (send button + keyboard submit). */
  onSubmit: () => void
  /** Transcribed voice text. */
  onVoiceResult: (text: string) => void
  parsing: boolean
  placeholder: string
  /** Analytics tag for VoiceButton. */
  module: string
  /** Optional helper line under the input. */
  hint?: string
  /** Optional header-right slot (e.g. "Set up AI" link). */
  headerRight?: ReactNode
  /** AI unavailable: input non-editable, voice/send disabled. */
  disabled?: boolean
  onInputFocus?: () => void
}

/**
 * The single Smart Entry surface shared by every entry form (finance, journal,
 * reminder). One fixed size, one button placement (voice + send pinned inside
 * the box, bottom-right) so the AI input looks identical across the app.
 */
export function SmartEntryCard({
  value, onChangeText, onSubmit, onVoiceResult, parsing,
  placeholder, module, hint, headerRight, disabled = false, onInputFocus,
}: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const accent = disabled ? theme.text.muted : theme.brand.primary
  const sendDisabled = parsing || disabled || !value.trim()

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
          <Feather name="zap" size={16} color={accent} />
        </View>
        <Text style={[styles.title, { color: accent }]}>{t.smart_entry}</Text>
        <View style={styles.spacer} />
        {headerRight ?? null}
      </View>

      <View style={[styles.inputWrap, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.text.muted}
          style={[styles.input, { color: theme.text.primary }]}
          multiline
          editable={!disabled && !parsing}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          onFocus={onInputFocus}
        />
        <View style={styles.actions}>
          <VoiceButton onResult={onVoiceResult} disabled={parsing || disabled} size={40} module={module} />
          <Pressable
            onPress={onSubmit}
            disabled={sendDisabled}
            style={[styles.send, { backgroundColor: sendDisabled ? theme.border.strong : theme.brand.primary }]}
            accessibilityRole="button"
          >
            {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
          </Pressable>
        </View>
      </View>

      {hint ? <Text style={[styles.hint, { color: theme.text.muted }]}>{hint}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  spacer: { flex: 1 },
  iconWrap: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  inputWrap: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    paddingBottom: 52,
  },
  input: { minHeight: 44, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  actions: {
    position: 'absolute',
    right: spacing[2],
    bottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  send: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12 },
})
