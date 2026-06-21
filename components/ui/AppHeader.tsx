import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { BrandMark } from './BrandMark'

type IconName = keyof typeof Feather.glyphMap

type Props = {
  title?: string
  subtitle?: string
  /** When set, a back chevron replaces the brand mark (for pushed sub-screens). */
  onBack?: () => void
  onSearch?: () => void
  /** Icon for the left action button (default 'search'). */
  searchIcon?: IconName
  /** Accessibility label + intent for the left action (default t.nav_search). */
  searchLabel?: string
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
  onBack,
  onSearch,
  searchIcon = 'search',
  searchLabel,
  onSettings,
}: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t.back}>
          <Feather name="chevron-left" size={24} color={theme.text.primary} />
        </Pressable>
      ) : (
        <BrandMark size={28} bg={theme.text.primary} glyph={theme.bg.elevated} />
      )}
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.text.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onSearch ? (
        <Pressable onPress={onSearch} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={searchLabel ?? t.nav_search}>
          <Feather name={searchIcon} size={18} color={theme.text.secondary} />
        </Pressable>
      ) : null}
      {onSettings ? (
        <Pressable onPress={onSettings} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t.nav_settings}>
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
  subtitle: { fontSize: 12, fontWeight: '500' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 30, height: 30, marginLeft: -4, alignItems: 'center', justifyContent: 'center' },
})
