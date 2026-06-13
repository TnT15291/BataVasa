import { useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { startOfMonth, endOfMonth } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceBootstrap, useCategories, useTransactions } from '../hooks/useFinance'
import { FAB } from '@components/FAB'
import { translateCategoryName, translateKind } from '../i18n'
import { formatAmount } from '../services'
import type { Category, CategoryKind } from '../types'

const KIND_ORDER: CategoryKind[] = ['essential', 'discretionary', 'income', 'savings']

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const theme = useTheme()
  const pct = Math.min(spent / budget, 1)
  const color =
    pct >= 1 ? theme.semantic.danger : pct >= 0.8 ? theme.semantic.warning : theme.semantic.success
  return (
    <View style={[styles.barTrack, { backgroundColor: theme.bg.secondary }]}>
      <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  )
}

export function CategoryListScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const cats = useCategories()
  const txs = useTransactions()
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)

  const monthSpend = useMemo(() => {
    const now = new Date()
    const from = startOfMonth(now)
    const to = endOfMonth(now)
    const map = new Map<string, number>()
    for (const tx of txs) {
      if (tx.amount_cents >= 0 || tx.currency !== currency) continue
      const d = new Date(tx.occurred_at)
      if (d >= from && d <= to) {
        map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + Math.abs(tx.amount_cents))
      }
    }
    return map
  }, [txs, currency])

  const grouped = useMemo(() => {
    const map = new Map<CategoryKind, Category[]>()
    for (const kind of KIND_ORDER) map.set(kind, [])
    for (const cat of cats) map.get(cat.kind)?.push(cat)
    return map
  }, [cats])

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        {KIND_ORDER.map((kind) => {
          const group = grouped.get(kind) ?? []
          if (group.length === 0) return null
          return (
            <View key={kind}>
              <Text style={[styles.groupHeader, { color: theme.text.muted }]}>
                {translateKind(kind, t)}
              </Text>
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                {group.map((cat, idx) => {
                  const isSystem = cat.user_id === null
                  const spent = monthSpend.get(cat.id) ?? 0
                  const hasBudget = !!cat.monthly_budget_cents
                  const isLast = idx === group.length - 1
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => isSystem ? undefined : router.push({ pathname: '/category', params: { id: cat.id } })}
                      disabled={isSystem}
                      style={({ pressed }) => [
                        styles.row,
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.subtle },
                        pressed && !isSystem && { backgroundColor: theme.bg.secondary },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: cat.color }]} />
                      <View style={styles.rowMid}>
                        <View style={styles.rowTop}>
                          <Text style={[styles.rowName, { color: theme.text.primary }]} numberOfLines={1}>
                            {translateCategoryName(cat, t)}
                          </Text>
                          {isSystem && (
                            <View style={[styles.badge, { backgroundColor: theme.bg.secondary }]}>
                              <Text style={[styles.badgeText, { color: theme.text.muted }]}>{t.system_category}</Text>
                            </View>
                          )}
                        </View>
                        {hasBudget && (
                          <>
                            <BudgetBar spent={spent} budget={cat.monthly_budget_cents!} />
                            <Text style={[styles.budgetText, { color: theme.text.muted }]}>
                              {formatAmount(spent, currency, language)} {t.budget_of} {formatAmount(cat.monthly_budget_cents!, currency, language)}
                            </Text>
                          </>
                        )}
                      </View>
                      {!isSystem && (
                        <Feather name="chevron-right" size={20} color={theme.text.muted} />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )
        })}
      </ScrollView>

      <FAB
        onPress={() => router.push('/category')}
        accessibilityLabel={t.new_category}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[2], paddingBottom: 80 },
  groupHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  rowMid: { flex: 1, gap: spacing[1] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowName: { fontSize: 15, fontWeight: '500', flex: 1 },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: 12, fontWeight: '600' },
  barTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  budgetText: { fontSize: 12 },
  fab: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[8],
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
})
