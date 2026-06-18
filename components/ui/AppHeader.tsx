import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'
import { BrandMark } from './BrandMark'

type Props = {
  title?: string
  subtitle?: string
  onSearch?: () => void
  onSettings?: () => void
}

/**
 * App bar from UI1.png: dark circular brand mark + bold "BataVasa" wordmark +
 * "AI Personal OS" subtitle on the left, ghost search + settings icons on the
 * right. Flat, no shadow.
 */
export function AppHeader({
  title = 'BataVasa',
  subtitle = 'AI Personal OS',
  onSearch,
  onSettings,
}: Props) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <BrandMark size={28} bg={theme.text.primary} glyph={theme.bg.elevated} />
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onSearch ? (
        <Pressable onPress={onSearch} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Search">
          <Feather name="search" size={18} color={theme.text.secondary} />
        </Pressable>
      ) : null}
      {onSettings ? (
        <Pressable onPress={onSettings} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Settings">
          <Feather name="settings" size={18} color={theme.text.secondary} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 4,
  },
  titleBlock: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 10, fontWeight: '500' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
})
