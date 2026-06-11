import { Pressable, Text, View, StyleSheet } from 'react-native'
import type { Mood } from '../types'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { spacing, radius } from '@design/tokens'

type Props = {
  value: Mood | null
  onChange: (m: Mood | null) => void
}

const MOODS: { value: Mood; emoji: string }[] = [
  { value: 'great', emoji: '😄' },
  { value: 'good', emoji: '🙂' },
  { value: 'neutral', emoji: '😐' },
  { value: 'low', emoji: '😕' },
  { value: 'bad', emoji: '😞' },
]

export function MoodSelector({ value, onChange }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const moodLabels: Record<Mood, string> = {
    great: t.mood_great,
    good: t.mood_good,
    neutral: t.mood_neutral,
    low: t.mood_low,
    bad: t.mood_bad,
  }
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MOODS.map((m) => {
        const active = value === m.value
        const label = moodLabels[m.value]
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(active ? null : m.value)}
            accessibilityRole="radio"
            accessibilityLabel={label}
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
            <Text style={{ color: active ? '#fff' : theme.text.muted, fontSize: 12 }} importantForAccessibility="no">
              {label}
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
