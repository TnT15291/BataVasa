import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useToastStore, type ToastKind } from '@store/toastStore'

type IconName = keyof typeof Feather.glyphMap

const ICON: Record<ToastKind, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
}

const VISIBLE_MS = 2800

/**
 * Global toast host. Mount once near the app root. Driven by `toastStore`, so
 * `toast.success(...)` from any save handler surfaces calm "Saved" feedback
 * (Cross-Module Rule 7 — never leave an action without acknowledgement).
 */
export function ToastHost() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const message = useToastStore((s) => s.message)
  const detail = useToastStore((s) => s.detail)
  const kind = useToastStore((s) => s.kind)
  const token = useToastStore((s) => s.token)
  const hide = useToastStore((s) => s.hide)

  const anim = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!message) return
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => hide())
    }, VISIBLE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // token forces re-trigger even when the same message repeats
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, message])

  if (!message) return null

  const accent =
    kind === 'success' ? theme.semantic.success
    : kind === 'error' ? theme.semantic.danger
    : theme.semantic.info

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + spacing[2],
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={hide}
        accessibilityRole="alert"
        accessibilityLabel={detail ? `${message}. ${detail}` : message}
        style={[styles.toast, { backgroundColor: theme.bg.elevated, borderColor: accent + '55' }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
          <Feather name={ICON[kind]} size={18} color={accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.message, { color: theme.text.primary }]} numberOfLines={2}>{message}</Text>
          {detail ? (
            <Text style={[styles.detail, { color: theme.text.muted }]} numberOfLines={2}>{detail}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    maxWidth: 440,
    width: '100%',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  message: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 12, marginTop: 2, lineHeight: 16 },
})
