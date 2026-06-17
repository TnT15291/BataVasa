import { useState } from 'react'
import {
  View, TextInput, Pressable, StyleSheet,
  type TextInputProps, type StyleProp, type ViewStyle, type TextStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  /** Merged onto the inner TextInput so callers can tweak layout. */
  style?: StyleProp<TextStyle>
  /** Wrapper style (e.g. margins) — kept separate from the input box. */
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * Password field with a show/hide eye toggle. Owns the masked-entry state so the
 * eye never desyncs from the input. Visual matches the auth form inputs; pass
 * `style` for per-screen tweaks. Used by AuthScreen and UpdatePasswordScreen.
 */
export function PasswordInput({ style, containerStyle, ...rest }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        placeholderTextColor={theme.text.muted}
        {...rest}
        secureTextEntry={!visible}
        autoCapitalize="none"
        style={[
          styles.input,
          { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated },
          style,
        ]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t.password_hide : t.password_show}
        hitSlop={10}
        style={styles.eye}
      >
        <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={theme.text.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  // Extra right padding leaves room for the eye button so text never sits under it.
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], paddingRight: spacing[3] + 32, fontSize: 15 },
  eye: { position: 'absolute', right: spacing[2], top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: spacing[2] },
})
