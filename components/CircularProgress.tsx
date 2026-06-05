import { View, StyleSheet } from 'react-native'

type Props = {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  color: string
  trackColor: string
  children?: React.ReactNode
}

export function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 3,
  color,
  trackColor,
  children,
}: Props) {
  const half = size / 2
  const clamped = Math.min(100, Math.max(0, progress))

  // Right half: covers 0–50%. Rotates from -180deg (0%) to 0deg (50%)
  const rightDeg = (Math.min(clamped, 50) / 50) * 180 - 180
  // Left half: covers 50–100%. Rotates from -180deg (50%) to 0deg (100%)
  const leftDeg = (Math.max(clamped - 50, 0) / 50) * 180 - 180

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: strokeWidth,
    borderColor: color,
    position: 'absolute' as const,
  }

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: half, borderWidth: strokeWidth, borderColor: trackColor },
        ]}
      />

      {/* Right half clip (shows 0–50%) */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, left: -half, width: size, height: size }}>
          <View style={[circleStyle, { transform: [{ rotate: `${rightDeg}deg` }] }]} />
        </View>
      </View>

      {/* Left half clip (shows 50–100%) */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, right: -half, width: size, height: size }}>
          <View style={[circleStyle, { transform: [{ rotate: `${leftDeg}deg` }] }]} />
        </View>
      </View>

      {/* Content */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        {children}
      </View>
    </View>
  )
}
