import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { MODULE_COLORS } from '@design/moduleColors'
import { BrandMark } from '@components/ui'

type IconName = keyof typeof Feather.glyphMap

function ModuleTabIcon({
  name,
  color,
  focused,
  home,
}: {
  name: IconName
  color: string
  focused: boolean
  home?: boolean
}) {
  const theme = useTheme()
  if (home) {
    const size = 40
    return (
      <View
        style={[
          styles.iconBadge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#fff',
            borderColor: focused ? theme.brand.primary : '#181B20',
            borderWidth: focused ? 2.5 : 2,
            shadowColor: theme.shadow.color,
            shadowOpacity: focused ? 0.12 : 0.06,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: focused ? 2 : 1,
          },
        ]}
      >
        <BrandMark size={28} bg="#fff" glyph={focused ? theme.brand.primary : '#181B20'} />
      </View>
    )
  }
  // Module tabs: gray when inactive, colored tint circle when active
  const size = 28
  return (
    <View
      style={[
        styles.iconBadge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: focused ? color + '18' : 'transparent',
        },
      ]}
    >
      <Feather name={name} size={18} color={focused ? color : theme.text.muted} />
    </View>
  )
}

export default function TabsLayout() {
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.bg.primary },
        headerTitleStyle: { color: theme.text.primary, fontWeight: '700', fontSize: 16 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.bg.elevated,
          borderTopColor: theme.border.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          minHeight: 62,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.text.primary,
        tabBarInactiveTintColor: theme.text.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -2 },
        tabBarItemStyle: { paddingVertical: 1 },
      }}
    >
      <Tabs.Screen
        name="habits"
        options={{
          title: t.habits,
          tabBarLabel: t.habits,
          tabBarActiveTintColor: MODULE_COLORS.habits,
          tabBarIcon: ({ focused }) => <ModuleTabIcon name="check-circle" color={MODULE_COLORS.habits} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="journals"
        options={{
          title: t.nav_journal,
          tabBarLabel: t.nav_journal,
          tabBarActiveTintColor: MODULE_COLORS.journal,
          tabBarIcon: ({ focused }) => <ModuleTabIcon name="book-open" color={MODULE_COLORS.journal} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'BataVasa',
          tabBarLabel: t.nav_home,
          tabBarIcon: ({ focused }) => <ModuleTabIcon name="home" color="#181B20" focused={focused} home />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t.nav_reminders,
          tabBarLabel: t.nav_reminders,
          tabBarActiveTintColor: MODULE_COLORS.tasks,
          tabBarIcon: ({ focused }) => <ModuleTabIcon name="bell" color={MODULE_COLORS.tasks} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: t.nav_finance,
          tabBarLabel: t.nav_finance,
          tabBarActiveTintColor: MODULE_COLORS.finance,
          tabBarIcon: ({ focused }) => <ModuleTabIcon name="trending-up" color={MODULE_COLORS.finance} focused={focused} />,
        }}
      />

      <Tabs.Screen name="modules" options={{ href: null }} />
      <Tabs.Screen name="launcher" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="you" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
