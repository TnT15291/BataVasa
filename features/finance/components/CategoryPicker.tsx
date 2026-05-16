import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import type { Category, CategoryKind } from '../types'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Props = {
  categories: Category[]
  selectedId: string | null
  onSelect: (c: Category) => void
  filterKind?: CategoryKind
}

const KIND_LABEL: Record<CategoryKind, string> = {
  essential: 'Essential',
  discretionary: 'Discretionary',
  income: 'Income',
  savings: 'Savings',
}

export function CategoryPicker({ categories, selectedId, onSelect, filterKind }: Props) {
  const theme = useTheme()
  const list = filterKind ? categories.filter((c) => c.kind === filterKind) : categories

  const grouped = list.reduce<Record<CategoryKind, Category[]>>(
    (acc, c) => {
      acc[c.kind].push(c)
      return acc
    },
    { essential: [], discretionary: [], income: [], savings: [] }
  )

  return (
    <ScrollView>
      {(Object.keys(grouped) as CategoryKind[]).map((kind) =>
        grouped[kind].length === 0 ? null : (
          <View key={kind} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.text.muted }]}>{KIND_LABEL[kind]}</Text>
            <View style={styles.chips}>
              {grouped[kind].map((c) => {
                const active = selectedId === c.id
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onSelect(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.color : theme.bg.elevated,
                        borderColor: active ? c.color : theme.border.subtle,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? '#fff' : theme.text.primary,
                        fontWeight: active ? '600' : '500',
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing[4] },
  groupTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
})
