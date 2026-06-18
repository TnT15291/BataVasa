import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

type Props = {
  label: string
  icon?: IconName
  /** Optional accent; defaults to a neutral muted chip. */
  color?: string
}

/** Small neutral tag chip (UI1 "Personal" / "Use rationale"). */
export function Chip({ label, icon, color }: Props) {
  const theme = useTheme()
  const tint = color ?? theme.text.muted
  return (
    <View style={[styles.chip, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
      {icon ? <Feather name={icon} size={9} color={tint} /> : null}
      <Text style={[styles.text, { color: theme.text.secondary }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '600' },
})
