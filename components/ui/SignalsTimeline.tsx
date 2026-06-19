import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

export type SignalLane = {
  key: string
  /** Module name — kept for the screen-reader label even though the lane renders an icon. */
  label: string
  icon: IconName
  color: string
  marks: number[]
}

type Props = {
  lanes: SignalLane[]
  axisLabels: string[]
  nowFraction?: number
  nowLabel?: string
}

const GUTTER = 30
const TRACK_H = 6
const clamp = (n: number) => Math.min(Math.max(n, 0), 1)

export function SignalsTimeline({ lanes, axisLabels, nowFraction, nowLabel }: Props) {
  const theme = useTheme()
  const nowPct = nowFraction !== undefined ? clamp(nowFraction) * 100 : null

  return (
    <View style={styles.wrap}>
      {nowPct !== null && nowLabel ? (
        <View style={styles.pillRow}>
          <View style={{ width: GUTTER }} />
          <View style={styles.trackArea}>
            <View style={[styles.nowPill, { left: `${nowPct}%`, backgroundColor: theme.command.bg }]}>
              <Text style={[styles.nowPillText, { color: theme.command.text }]}>{nowLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.axisRow}>
        <View style={{ width: GUTTER }} />
        <View style={styles.axisLabels}>
          {axisLabels.map((label, i) => (
            <Text key={`${label}-${i}`} style={[styles.axisLabel, { color: theme.text.muted }]}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      {lanes.map((lane) => (
        <View key={lane.key} style={styles.laneRow}>
          <View
            style={styles.laneIcon}
            accessibilityRole="image"
            accessibilityLabel={lane.label}
          >
            <Feather name={lane.icon} size={13} color={lane.color} />
          </View>
          <View style={[styles.track, { backgroundColor: theme.bg.secondary }]}>
            {nowPct !== null ? (
              <View style={[styles.nowLine, { left: `${nowPct}%`, backgroundColor: theme.text.muted }]} />
            ) : null}
            {lane.marks.map((frac, i) => (
              <View
                key={i}
                style={[styles.mark, { left: `${clamp(frac) * 100}%`, backgroundColor: lane.color }]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  pillRow: { flexDirection: 'row', height: 14 },
  trackArea: { flex: 1, position: 'relative' },
  nowPill: {
    position: 'absolute',
    marginLeft: -18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },
  nowPillText: { fontSize: 8, fontWeight: '700' },
  axisRow: { flexDirection: 'row', alignItems: 'center' },
  axisLabels: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 8, fontWeight: '500' },
  laneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  laneIcon: { width: GUTTER - 8, alignItems: 'center' },
  track: {
    flex: 1,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  nowLine: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 1,
    opacity: 0.5,
  },
  mark: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
  },
})
