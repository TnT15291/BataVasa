import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

export type ModuleTabItem = {
  key: string
  label: string
  icon: IconName
  color?: string
}

type Props = {
  items: ModuleTabItem[]
  activeKey: string
  onSelect: (key: string) => void
}

export function ModuleTabBar({ items, activeKey, onSelect }: Props) {
  const theme = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      {items.map((item) => {
        const active = item.key === activeKey
        const accent = active ? (item.color ?? theme.text.primary) : theme.text.muted
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active && { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle },
            ]}
          >
            <View style={styles.tabInner}>
              <Feather name={item.icon} size={15} color={accent} />
              <Text
                style={[
                  styles.label,
                  { color: active ? theme.text.primary : theme.text.muted, fontWeight: active ? '700' : '600' },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
            <View
              style={[
                styles.underline,
                { backgroundColor: active ? (item.color ?? theme.text.primary) : 'transparent' },
              ]}
            />
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing[3], paddingRight: spacing[4] },
  tab: {
    width: 58,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingTop: spacing[2],
  },
  tabInner: { alignItems: 'center', gap: 4, paddingVertical: spacing[1] },
  label: { fontSize: 10, fontWeight: '600' },
  underline: { height: 2, alignSelf: 'stretch', borderRadius: 2 },
})
