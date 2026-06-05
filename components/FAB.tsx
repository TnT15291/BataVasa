import { type ReactNode } from 'react'
import { type ViewStyle, type AccessibilityRole } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated'
import { Pressable } from 'react-native'

type Props = {
  onPress: () => void
  style: ViewStyle | ViewStyle[]
  accessibilityLabel: string
  accessibilityRole?: AccessibilityRole
  children: ReactNode
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function FAB({ onPress, style, accessibilityLabel, accessibilityRole = 'button', children }: Props) {
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.88, { damping: 10, stiffness: 200, reduceMotion: ReduceMotion.System }) }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200, reduceMotion: ReduceMotion.System }) }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  )
}
