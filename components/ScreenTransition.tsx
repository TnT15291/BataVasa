import { useEffect } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated'

type Props = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Wraps a screen root with a 250ms fade + 6px slide-up on first mount.
 * Fires once — tabs keep screens mounted so re-visiting a tab is instant.
 */
export function ScreenTransition({ children, style }: Props) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(6)

  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System }
    opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad), ...cfg })
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic), ...cfg })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  )
}
