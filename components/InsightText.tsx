import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Section = {
  title: string
  body: string[]
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .trim()
}

function parseInsightText(text: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const isHeading = /^#{1,6}\s+/.test(line) || /^\d+\.\s+\*\*.+\*\*/.test(line) || /^\*\*.+\*\*:?\s*$/.test(line)
    if (isHeading) {
      if (current) sections.push(current)
      current = { title: cleanLine(line).replace(/:$/, ''), body: [] }
      continue
    }

    const cleaned = cleanLine(line)
    if (!cleaned) continue
    if (!current) current = { title: '', body: [] }
    current.body.push(cleaned)
  }

  if (current) sections.push(current)

  if (sections.length <= 1) {
    const body = text
      .split('\n')
      .map(cleanLine)
      .filter(Boolean)
    return body.map((line, index) => ({ title: index === 0 ? line : '', body: index === 0 ? [] : [line] }))
  }

  return sections.filter((section) => section.title || section.body.length > 0)
}

export function InsightText({ text }: { text: string }) {
  const theme = useTheme()
  const sections = parseInsightText(text)

  return (
    <View style={styles.wrap}>
      {sections.map((section, index) => (
        <View
          key={`${section.title}-${index}`}
          style={[styles.section, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
        >
          {section.title ? (
            <View style={styles.titleRow}>
              <Feather name="zap" size={14} color={theme.brand.primary} />
              <Text style={[styles.title, { color: theme.text.primary }]}>{section.title}</Text>
            </View>
          ) : null}
          {section.body.map((line, lineIndex) => (
            <View key={`${line}-${lineIndex}`} style={styles.lineRow}>
              <View style={[styles.dot, { backgroundColor: theme.brand.primary }]} />
              <Text style={[styles.body, { color: theme.text.secondary }]}>{line}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  dot: { width: 4, height: 4, borderRadius: radius.full, marginTop: 8 },
  body: { flex: 1, fontSize: 13, lineHeight: 20 },
})
