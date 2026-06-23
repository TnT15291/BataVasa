import type { ReactNode } from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'
import { Card } from './Card'

type Props = {
  /** Soft section label (not uppercase). Omit for an untitled grouping card. */
  title?: string
  /** Right-aligned slot next to the title (e.g. a toggle or count). */
  right?: ReactNode
  children: ReactNode
  style?: ViewStyle | ViewStyle[]
}

/**
 * Lightweight form grouping card: a calm text title (no 30px icon circle) over a
 * themed Card. Replaces the heavy per-setting `card + cardHeader + cardIcon`
 * pattern so entry forms read as one quiet surface instead of stacked badges.
 */
export function FormSection({ title, right, children, style }: Props) {
  const theme = useTheme()
  return (
    <Card style={style}>
      {title ? (
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.secondary }]}>{title}</Text>
          {right ?? null}
        </View>
      ) : null}
      {children}
    </Card>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  title: { fontSize: 13, fontWeight: '600' },
})
