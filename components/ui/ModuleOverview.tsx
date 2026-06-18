import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap
export type OverviewStat = { key: string; label: string; value: string; color?: string }

type Props = {
  eyebrow: string
  value: string
  subtitle?: string
  icon: IconName
  /** Module identity color for the icon badge. */
  accent: string
  stats?: OverviewStat[]
}

/**
 * Console-style module overview card (Habits / Journal / Reminders headers):
 * eyebrow + big value + subtitle on the left, a tinted module-color icon badge
 * on the right, and an optional stats strip under a hairline rule. Flat + calm.
 */
export function ModuleOverview({ eyebrow, value, subtitle, icon, accent, stats }: Props) {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <View style={styles.top}>
        <View style={styles.head}>
          <Text style={[styles.eyebrow, { color: theme.text.muted }]}>{eyebrow.toUpperCase()}</Text>
          <Text style={[styles.value, { color: theme.text.primary }]} numberOfLines={1}>{value}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Feather name={icon} size={18} color="#fff" />
        </View>
      </View>
      {stats && stats.length > 0 ? (
        <View style={[styles.stats, { borderTopColor: theme.border.subtle }]}>
          {stats.map((s) => (
            <View key={s.key} style={styles.stat}>
              <Text style={[styles.statValue, { color: s.color ?? theme.text.primary }]} numberOfLines={1}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  head: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  value: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  badge: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },
})
