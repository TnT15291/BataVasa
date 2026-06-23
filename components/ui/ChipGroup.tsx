import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type ChipRole = 'button' | 'checkbox'

type SelectableChipProps = {
  label: string
  active?: boolean
  onPress: () => void
  /** Accent for the selected state; defaults to brand. */
  color?: string
  accessibilityRole?: ChipRole
}

/**
 * One selectable pill. The single source of truth for the app's "chosen" look:
 * a tinted background + accent text + accent border (calm), never a solid fill.
 * Used by ChipGroup and directly for multi-select rows (tags, templates).
 */
export function SelectableChip({ label, active = false, onPress, color, accessibilityRole = 'button' }: SelectableChipProps) {
  const theme = useTheme()
  const accent = color ?? theme.brand.primary
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityRole === 'checkbox' ? { checked: active } : { selected: active }}
      style={[styles.chip, {
        backgroundColor: active ? accent + '22' : theme.bg.primary,
        borderColor: active ? accent : theme.border.subtle,
      }]}
    >
      <Text style={[styles.chipText, { color: active ? accent : theme.text.secondary }]}>{label}</Text>
    </Pressable>
  )
}

type Option<T> = { value: T; label: string }

type ChipGroupProps<T> = {
  label?: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  color?: string
}

/** A labelled single-select row of pills. */
export function ChipGroup<T extends string | number>({ label, options, value, onChange, color }: ChipGroupProps<T>) {
  const theme = useTheme()
  return (
    <View style={styles.group}>
      {label ? <Text style={[styles.label, { color: theme.text.muted }]}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((opt) => (
          <SelectableChip
            key={String(opt.value)}
            label={opt.label}
            active={opt.value === value}
            onPress={() => onChange(opt.value)}
            color={color}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing[2] },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
})
