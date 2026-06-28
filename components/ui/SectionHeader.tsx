import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Props = {
  /** Short functional label, rendered UPPERCASE + tracked (e.g. "Review queue"). */
  label: string
  count?: number
  /** Right-aligned action link (e.g. "View all"). */
  actionLabel?: string
  onAction?: () => void
  /**
   * Optional compact "+" button after the action link — a FAB-equivalent for a
   * section whose module has no bottom-nav entry of its own (e.g. Goals on home).
   */
  onAdd?: () => void
  addLabel?: string
}

/**
 * Functional list-section header from UI1.png: small uppercase tracked label,
 * optional count, optional right-aligned action link. Consistent across every
 * module — this is the section rhythm of the whole app.
 */
export function SectionHeader({ label, count, actionLabel, onAction, onAdd, addLabel }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text.muted }]}>{label.toUpperCase()}</Text>
      {count !== undefined ? (
        <Text style={[styles.count, { color: theme.text.muted }]}>{count}</Text>
      ) : null}
      <View style={styles.spacer} />
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: theme.brand.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={[styles.addBtn, { borderColor: theme.brand.primary + '55', backgroundColor: theme.brand.primary + '14' }]}
        >
          <Feather name="plus" size={15} color={theme.brand.primary} />
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
    minHeight: 20,
    marginBottom: 2,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  count: { fontSize: 12, fontWeight: '700' },
  spacer: { flex: 1 },
  action: { fontSize: 13, fontWeight: '600' },
  addBtn: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})
