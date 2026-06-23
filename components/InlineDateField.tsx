import { useState } from 'react'
import { Platform, Pressable, Text, StyleSheet, Modal, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { spacing, radius } from '@design/tokens'

type Props = {
  /** Current value, or null when the date is not set yet (e.g. a missing due date). */
  value: Date | null
  onChange: (next: Date) => void
  /** 'datetime' shows a time component too (reminders); 'date' is day-only. */
  mode?: 'date' | 'datetime'
  minimumDate?: Date
  maximumDate?: Date
  /** Accent color (module color) for the chip. */
  color?: string
  /** Shown when value is null, e.g. "Set date". */
  placeholder?: string
}

// Compact, tappable date chip for inline editing on cards. Unlike DateRow it
// takes configurable min/max so future-dated modules (reminders, debt due dates,
// goal deadlines) work, and renders as a chip instead of a full form row.
export function InlineDateField({ value, onChange, mode = 'date', minimumDate, maximumDate, color, placeholder }: Props) {
  const theme = useTheme()
  const language = useSettingsStore((s) => s.language)
  const accent = color ?? theme.brand.primary
  const [showPicker, setShowPicker] = useState(false)
  const [pickMode, setPickMode] = useState<'date' | 'time'>('date')

  const seed = value ?? clampToRange(new Date(), minimumDate, maximumDate)
  const fmt = mode === 'datetime' ? 'dd/MM/yyyy · HH:mm' : 'dd/MM/yyyy'
  const label = value ? format(value, fmt, { locale: getDateFnsLocale(language) }) : (placeholder ?? format(seed, fmt, { locale: getDateFnsLocale(language) }))

  const handleNativeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (event.type === 'set' && selected) {
      onChange(selected)
      if (Platform.OS === 'android' && mode === 'datetime' && pickMode === 'date') {
        setPickMode('time')
        setTimeout(() => setShowPicker(true), 100)
      } else {
        setPickMode('date')
      }
    } else if (event.type === 'dismissed') {
      setShowPicker(false)
      setPickMode('date')
    }
  }

  const open = () => {
    setPickMode('date')
    setShowPicker(true)
  }

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.chip, { borderColor: accent + '55', backgroundColor: accent + '12' }]}
      >
        <Feather name="calendar" size={13} color={accent} />
        <Text style={[styles.chipText, { color: value ? theme.text.primary : theme.text.muted }]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name="edit-2" size={11} color={theme.text.muted} />
      </Pressable>

      {showPicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={seed}
          mode={Platform.OS === 'ios' ? mode : pickMode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleNativeChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {showPicker && Platform.OS === 'web' && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.webBackdrop} onPress={() => setShowPicker(false)}>
            <View style={[styles.webSheet, { backgroundColor: theme.bg.elevated }]} onStartShouldSetResponder={() => true}>
              {/* eslint-disable-next-line react/no-unknown-property */}
              <input
                type={mode === 'datetime' ? 'datetime-local' : 'date'}
                value={mode === 'datetime' ? toLocalInput(seed) : toLocalDateInput(seed)}
                min={minimumDate ? (mode === 'datetime' ? toLocalInput(minimumDate) : toLocalDateInput(minimumDate)) : undefined}
                max={maximumDate ? (mode === 'datetime' ? toLocalInput(maximumDate) : toLocalDateInput(maximumDate)) : undefined}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value
                  if (v) onChange(new Date(v))
                }}
                style={{
                  padding: 12,
                  fontSize: 16,
                  border: `1px solid ${theme.border.strong}`,
                  borderRadius: 8,
                  background: theme.bg.secondary,
                  color: theme.text.primary,
                }}
              />
              <Pressable style={[styles.webDone, { backgroundColor: theme.brand.primary }]} onPress={() => setShowPicker(false)}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>OK</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  )
}

function clampToRange(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return min
  if (max && d > max) return max
  return d
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 36,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  webBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  webSheet: {
    padding: spacing[4],
    borderRadius: radius.lg,
    minWidth: 280,
    gap: spacing[3],
  },
  webDone: {
    padding: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
})
