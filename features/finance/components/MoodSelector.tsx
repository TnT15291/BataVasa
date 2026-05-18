import { Pressable, Text, View, StyleSheet } from 'react-native'
import type { Mood } from '../types'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Props = {
  value: Mood | null
  onChange: (m: Mood | null) => void
}

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'low', emoji: '😕', label: 'Low' },
  { value: 'bad', emoji: '😞', label: 'Bad' },
]

export function MoodSelector({ value, onChange }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MOODS.map((m) => {
        const active = value === m.value
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(active ? null : m.value)}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ checked: active }}
            style={[
              styles.item,
              {
                backgroundColor: active ? theme.brand.primary : theme.bg.elevated,
                borderColor: active ? theme.brand.primary : theme.border.subtle,
              },
            ]}
          >
            <Text style={styles.emoji} importantForAccessibility="no">{m.emoji}</Text>
            <Text style={{ color: active ? '#fff' : theme.text.muted, fontSize: 11 }} importantForAccessibility="no">
              {m.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[2] },
  item: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  emoji: { fontSize: 22 },
})
