import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme, getCardStyle } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'
import { Chip } from './Chip'
import { Sparkle } from './BrandMark'

type Props = {
  label: string
  text: string
  tags?: string[]
  actionLabel?: string
  onAction?: () => void
}

export function AIInsightCard({ label, text, tags, actionLabel, onAction }: Props) {
  const theme = useTheme()
  const cardSt = getCardStyle(theme)
  return (
    <View style={[styles.card, cardSt, { backgroundColor: theme.bg.elevated }]}>
      <View style={styles.header}>
        <Sparkle size={11} color={theme.brand.primary} />
        <Text style={[styles.label, { color: theme.text.muted }]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[styles.text, { color: theme.text.secondary }]}>{text}</Text>
      {(tags && tags.length > 0) || (actionLabel && onAction) ? (
        <View style={styles.footer}>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} hitSlop={8} style={styles.action} accessibilityRole="button">
              <Feather name="info" size={11} color={theme.text.muted} />
              <Text style={[styles.actionText, { color: theme.text.muted }]}>{actionLabel}</Text>
            </Pressable>
          ) : <View />}
          <View style={styles.tags}>
            {tags?.map((tag) => (
              <Chip key={tag} label={tag} icon="user" />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, padding: spacing[2], gap: 5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  text: { fontSize: 13, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11, fontWeight: '600' },
})
