import { ScrollView, StyleSheet, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { ScreenTransition } from '@components/ScreenTransition'
import { AppHeader, SectionHeader, ListRow } from '@components/ui'

type IconName = keyof typeof Feather.glyphMap
type ModuleEntry = { key: string; icon: IconName; title: string; subtitle: string; color: string; route: string }

/** "Modules" tab — the directory of every domain surface, on the console style. */
export function ModulesScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()

  const modules: ModuleEntry[] = [
    { key: 'finance',   icon: MODULE_ICONS.finance, title: t.nav_finance,   subtitle: t.finance_settings,   color: MODULE_COLORS.finance,  route: '/finance' },
    { key: 'habits',    icon: MODULE_ICONS.habits,  title: t.habits,        subtitle: t.nav_insights,        color: MODULE_COLORS.habits,   route: '/habits' },
    { key: 'journal',   icon: MODULE_ICONS.journal, title: t.nav_journal,   subtitle: t.nav_insights,        color: MODULE_COLORS.journal,  route: '/journals' },
    { key: 'reminders', icon: MODULE_ICONS.tasks,   title: t.nav_reminders, subtitle: t.nav_insights,        color: MODULE_COLORS.tasks,    route: '/reminders' },
    { key: 'insights',  icon: MODULE_ICONS.analysis,title: t.nav_insights,  subtitle: t.ai_insight,          color: MODULE_COLORS.analysis, route: '/analysis' },
    { key: 'search',    icon: MODULE_ICONS.search,  title: t.nav_search,    subtitle: t.search_title,        color: MODULE_COLORS.analysis, route: '/search' },
    { key: 'goals',     icon: MODULE_ICONS.goals,   title: t.nav_goals,     subtitle: t.goal_module_hint,    color: MODULE_COLORS.analysis, route: '/goals' },
  ]

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader subtitle={t.nav_modules} onSettings={() => router.push('/settings')} />
        <View style={styles.block}>
          <SectionHeader label={t.nav_modules} />
          <View style={styles.list}>
            {modules.map((m) => (
              <ListRow
                key={m.key}
                icon={m.icon}
                color={m.color}
                title={m.title}
                subtitle={m.subtitle}
                onPress={() => router.navigate(m.route as any)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: 120, gap: spacing[4] },
  block: { gap: spacing[1] },
  list: { gap: 2 },
})
