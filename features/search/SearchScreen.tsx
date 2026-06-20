import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { searchAll, type SearchModule, type SearchResult } from '@services/search'
import { ScreenTransition } from '@components/ScreenTransition'
import { EmptyState, ListRow, SectionHeader } from '@components/ui'

type IconName = keyof typeof Feather.glyphMap

const MODULE_META: Record<SearchModule, { icon: IconName; color: string }> = {
  finance: { icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance },
  reminders: { icon: MODULE_ICONS.tasks, color: MODULE_COLORS.tasks },
  habits: { icon: MODULE_ICONS.habits, color: MODULE_COLORS.habits },
  journals: { icon: MODULE_ICONS.journal, color: MODULE_COLORS.journal },
  goals: { icon: MODULE_ICONS.goals, color: MODULE_COLORS.analysis },
}

export function SearchScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        if (query.trim().length < 2) {
          setResults([])
          setLoading(false)
          return
        }
        setLoading(true)
        try {
          const rows = await searchAll(query)
          if (!cancelled) setResults(rows)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<SearchModule, SearchResult[]>()
    for (const row of results) {
      const list = map.get(row.module) ?? []
      list.push(row)
      map.set(row.module, list)
    }
    return Array.from(map.entries())
  }, [results])

  const labelFor = (module: SearchModule): string => {
    if (module === 'finance') return t.nav_finance
    if (module === 'reminders') return t.nav_reminders
    if (module === 'habits') return t.habits
    if (module === 'journals') return t.journals
    return t.goals
  }

  const openResult = (result: SearchResult) => {
    router.push(result.routeParams ? { pathname: result.route as any, params: result.routeParams } : result.route as any)
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[3] }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <Feather name="search" size={18} color={theme.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.search_placeholder}
            placeholderTextColor={theme.text.muted}
            style={[styles.input, { color: theme.text.primary }]}
            autoFocus
          />
          {loading ? <ActivityIndicator size="small" color={theme.brand.primary} /> : null}
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={18} color={theme.text.muted} />
            </Pressable>
          ) : null}
        </View>

        {query.trim().length < 2 ? (
          <EmptyState icon="search" accent={MODULE_COLORS.analysis} title={t.search_title} body={t.search_empty} />
        ) : !loading && results.length === 0 ? (
          <EmptyState icon="search" accent={MODULE_COLORS.analysis} title={t.search_no_results} body={query.trim()} />
        ) : (
          grouped.map(([module, items]) => {
            const meta = MODULE_META[module]
            return (
              <View key={module} style={styles.block}>
                <SectionHeader label={labelFor(module)} count={items.length} />
                <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                  {items.map((item) => (
                    <ListRow
                      key={`${item.module}-${item.id}`}
                      icon={meta.icon}
                      color={meta.color}
                      title={item.title}
                      subtitle={item.subtitle}
                      meta={item.occurredAt ? item.occurredAt.slice(0, 10) : undefined}
                      onPress={() => openResult(item)}
                    />
                  ))}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  searchBox: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing[3] },
  block: { gap: spacing[2] },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing[2], gap: spacing[1] },
})
