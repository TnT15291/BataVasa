import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

const MONO = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' })

type Props = {
  placeholder: string
  onPress: () => void
}

export function CommandBar({ placeholder, onPress }: Props) {
  const theme = useTheme()
  const cmd = theme.command
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: cmd.bg, borderColor: cmd.border, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Text style={[styles.prompt, { color: cmd.text, fontFamily: MONO }]}>{'>_'}</Text>
      <Text style={[styles.placeholder, { color: cmd.placeholder }]} numberOfLines={1}>
        {placeholder}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  prompt: { fontSize: 14, fontWeight: '700' },
  placeholder: { flex: 1, fontSize: 14, fontWeight: '500' },
})
