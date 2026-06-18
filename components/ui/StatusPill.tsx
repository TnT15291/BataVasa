import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap
export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

type Props = {
  label: string
  tone?: PillTone
  icon?: IconName
}

export function StatusPill({ label, tone = 'neutral', icon }: Props) {
  const theme = useTheme()
  const color =
    tone === 'success' ? theme.semantic.success
    : tone === 'warning' ? theme.semantic.warning
    : tone === 'danger' ? theme.semantic.danger
    : tone === 'info' ? theme.semantic.info
    : theme.text.muted

  return (
    <View style={[styles.pill, { backgroundColor: color + '1A' }]}>
      {icon ? <Feather name={icon} size={9} color={color} /> : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '700' },
})
