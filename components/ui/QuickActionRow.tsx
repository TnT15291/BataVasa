import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

export type QuickAction = {
  key: string
  icon: IconName
  label: string
  onPress: () => void
  showLabel?: boolean
  featured?: boolean
  color?: string
}

type Props = { actions: QuickAction[] }

export function QuickActionRow({ actions }: Props) {
  const theme = useTheme()
  return (
    <View style={[styles.row, { borderTopColor: theme.border.subtle }]}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => {
            const accent = a.color ?? theme.text.secondary
            return [
              a.featured ? styles.featuredItem : styles.item,
              {
                backgroundColor: a.featured ? theme.brand.primary : a.color ? accent + '10' : theme.bg.elevated,
                borderColor: a.featured ? theme.brand.primary : a.color ? accent + '33' : theme.border.subtle,
                opacity: pressed ? 0.65 : 1,
              },
            ]
          }}
        >
          <Feather
            name={a.icon}
            size={a.featured ? 18 : 15}
            color={a.featured ? theme.brand.onPrimary : a.color ?? theme.text.secondary}
          />
          {a.showLabel === false ? null : (
            <Text style={[styles.label, { color: a.color ?? theme.text.secondary }]} numberOfLines={1}>
              {a.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[2],
  },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
  },
  featuredItem: {
    width: 42,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '700' },
})
