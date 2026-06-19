import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

type Props = {
  icon: IconName
  /** Module identity color for the tinted icon badge (MODULE_COLORS.*). */
  accent: string
  title: string
  body?: string
  cta?: { label: string; onPress: () => void }
}

/**
 * Console-style empty state (UI1.png): a soft tinted circular icon badge in the
 * module color + title + muted body + optional pill CTA. Replaces the old
 * 48px-emoji empty blocks so AI/report screens match the new list-screen look.
 */
export function EmptyState({ icon, accent, title, body, cta }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
        <Feather name={icon} size={32} color={accent} />
      </View>
      <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: theme.text.muted }]}>{body}</Text> : null}
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          style={[styles.cta, { backgroundColor: accent }]}
        >
          <Text style={styles.ctaText}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[12], paddingHorizontal: spacing[6], gap: spacing[3] },
  iconWrap: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cta: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[1] },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
