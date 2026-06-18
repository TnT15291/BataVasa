import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

// 4-point concave "sparkle" — the BataVasa glyph (matches assets/brand-icon).
const SPARKLE = 'M12 1 Q12 12 23 12 Q12 12 12 23 Q12 12 1 12 Q12 12 12 1 Z'

type MarkProps = {
  size?: number
  /** Circle background — defaults to near-black, matching UI1's header logo. */
  bg?: string
  glyph?: string
}

/** Dark circular brand badge with the white sparkle glyph (UI1 top-left logo). */
export function BrandMark({ size = 34, bg = '#181B20', glyph = '#FFFFFF' }: MarkProps) {
  const inner = Math.round(size * 0.58)
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={inner} height={inner} viewBox="0 0 24 24">
        <Path d={SPARKLE} fill={glyph} />
      </Svg>
    </View>
  )
}

/** Bare sparkle glyph, for inline accents (e.g. the AI INSIGHT label). */
export function Sparkle({ size = 14, color = '#181B20' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SPARKLE} fill={color} />
    </Svg>
  )
}
