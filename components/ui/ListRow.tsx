import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

type Props = {
  icon?: IconName
  emoji?: string
  color: string
  title: string
  subtitle?: string
  meta?: string
  metaColor?: string
  right?: ReactNode
  hideChevron?: boolean
  onPress?: () => void
  onLongPress?: () => void
  accessibilityLabel?: string
}

export function ListRow({
  icon,
  emoji,
  color,
  title,
  subtitle,
  meta,
  metaColor,
  right,
  hideChevron,
  onPress,
  onLongPress,
  accessibilityLabel,
}: Props) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}: ${subtitle}` : title)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : 'transparent' },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Feather name={icon ?? 'circle'} size={12} color="#fff" />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? (
        right
      ) : (
        <View style={styles.trailing}>
          {meta ? (
            <Text style={[styles.meta, { color: metaColor ?? theme.text.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {hideChevron ? null : <Feather name="chevron-right" size={14} color={theme.text.muted} />}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 34,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 13 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: '600' },
  subtitle: { fontSize: 10, fontWeight: '500' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  meta: { fontSize: 10, fontWeight: '500' },
})
