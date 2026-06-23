import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'
import { IconBadge } from './IconBadge'

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
      <IconBadge color={color} icon={icon} emoji={emoji} size="md" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.text.secondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? (
        right
      ) : (
        <View style={styles.trailing}>
          {meta ? (
            <Text style={[styles.meta, { color: metaColor ?? theme.text.secondary }]} numberOfLines={1}>
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
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  trailing: { maxWidth: 116, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  meta: { fontSize: 12, fontWeight: '600' },
})
