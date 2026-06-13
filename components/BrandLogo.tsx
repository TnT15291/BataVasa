import { Image, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Props = {
  size?: number
  showName?: boolean
}

const logoSource = require('../assets/brand-icon.png')

export function BrandLogo({ size = 76, showName = true }: Props) {
  const theme = useTheme()

  return (
    <View style={styles.wrap}>
      <Image
        source={logoSource}
        accessibilityLabel="BataVasa"
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.22),
            borderColor: theme.border.subtle,
          },
        ]}
      />
      {showName ? (
        <Text style={[styles.name, { color: theme.text.primary }]}>BataVasa</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing[3],
  },
  image: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
})
