import { Tabs, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { ModuleLauncherSheet } from '@features/home/components/ModuleLauncherSheet'

function HeaderRight() {
  const router = useRouter()
  const theme = useTheme()
  return (
    <View style={styles.headerRight}>
      <Pressable onPress={() => router.push('/help')} hitSlop={8} style={styles.headerBtn}>
        <Feather name="help-circle" size={22} color={theme.text.secondary} />
      </Pressable>
      <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerBtn}>
        <Feather name="settings" size={22} color={theme.text.secondary} />
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  const theme = useTheme()
  const { t } = useTranslation()
  const [launcherOpen, setLauncherOpen] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg.elevated },
          headerTitleStyle: { color: theme.text.primary, fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: theme.bg.elevated,
            borderTopColor: theme.border.subtle,
            borderTopWidth: StyleSheet.hairlineWidth,
            minHeight: 62,
            paddingBottom: 6,
          },
          tabBarActiveTintColor: theme.brand.primary,
          tabBarInactiveTintColor: theme.text.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'BataVasa',
            headerRight: () => <HeaderRight />,
            tabBarLabel: t.nav_home,
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: t.nav_finance,
            tabBarLabel: t.nav_finance,
            tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={22} color={color} />,
            tabBarActiveTintColor: theme.finance.expense,
          }}
        />
        <Tabs.Screen
          name="launcher"
          options={{
            title: t.module_launcher_title,
            tabBarLabel: '',
            tabBarButton: () => (
              <Pressable
                onPress={() => setLauncherOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t.module_launcher_title}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.launcherButton,
                  {
                    backgroundColor: pressed ? theme.brand.primary + 'DD' : theme.brand.primary,
                    borderColor: theme.bg.elevated,
                  },
                ]}
              >
                <Feather name="grid" size={24} color="#fff" />
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: t.habits,
            tabBarLabel: t.nav_habits,
            tabBarIcon: ({ color }) => <Feather name="check-circle" size={22} color={color} />,
            tabBarActiveTintColor: MODULE_COLORS.habits,
          }}
        />
        <Tabs.Screen
          name="journals"
          options={{
            title: t.nav_journal,
            tabBarLabel: t.nav_journal,
            tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
            tabBarActiveTintColor: MODULE_COLORS.journal,
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            href: null,
            title: t.nav_reminders,
          }}
        />
      </Tabs>
      <ModuleLauncherSheet visible={launcherOpen} onClose={() => setLauncherOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  headerBtn: { paddingHorizontal: 4 },
  launcherButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
