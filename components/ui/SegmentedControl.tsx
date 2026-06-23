import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap

type Option<T extends string> = {
  key: T
  label: string
  color?: string
  icon?: IconName
}

type Props<T extends string> = {
  value: T
  options: Array<Option<T>>
  onChange: (value: T) => void
  style?: ViewStyle | ViewStyle[]
}

export function SegmentedControl<T extends string>({ value, options, onChange, style }: Props<T>) {
  const theme = useTheme()
  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }, style]}>
      {options.map((option) => {
        const active = value === option.key
        const color = option.color ?? theme.brand.primary
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={[styles.segment, { backgroundColor: active ? color + '18' : 'transparent' }]}
          >
            {option.icon ? <Feather name={option.icon} size={14} color={active ? color : theme.text.secondary} /> : null}
            <Text style={[styles.label, { color: active ? color : theme.text.secondary }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 44,
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  label: { fontSize: 13, fontWeight: '700' },
})
