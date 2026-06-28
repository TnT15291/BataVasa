import { chatCompletion, isAiAvailable } from './openai'
import { withUserContext, type UserMemoryDomain } from './userContextPrompt'
import { useSettingsStore } from '@store/settingsStore'

export type HomeStorySnapshot = {
  language: string
  focus: string
  money: string
  habits: string
  tasks: string
  journal: string
  goal?: string
  risks: string[]
}

/**
 * Deterministic coach line used before the AI replies and whenever AI is
 * unavailable. Leads with the single most pressing signal (risk → goal →
 * money) so the home screen always opens by naming what matters, not by
 * listing stats. Falls back to the focus line when nothing is pressing.
 */
export function buildHomeStoryFallback(snapshot: HomeStorySnapshot): string {
  const firstRisk = snapshot.risks[0]
  if (firstRisk) return `${firstRisk} ${snapshot.focus}`
  if (snapshot.goal) return `${snapshot.focus} ${snapshot.goal}`
  return `${snapshot.focus} ${snapshot.money}`
}

export async function generateHomeStoryLine(snapshot: HomeStorySnapshot): Promise<string> {
  if (!isAiAvailable()) throw new Error('NO_BACKEND')

  const memoryQuery = [
    snapshot.focus,
    snapshot.money,
    snapshot.habits,
    snapshot.tasks,
    snapshot.journal,
    snapshot.goal ?? '',
    ...snapshot.risks,
  ].filter(Boolean).join(' ')

  const systemPrompt = [
    `Reply in ${snapshot.language} only.`,
    'You are a calm personal coach speaking on the home screen of a life app.',
    'Write ONE warm, specific line that (1) names the single most important thing or risk today, then (2) ends with one gentle, doable suggestion.',
    'Lead with a risk when one is present. Use the provided facts and the user memory only — never invent numbers, tasks, or goals.',
    'Speak to the person directly and kindly. No judgement, no markdown, no lists. Maximum 36 words.',
  ].join(' ')
  const memoryDomains: UserMemoryDomain[] | undefined = useSettingsStore.getState().hideJournals
    ? ['finance', 'habits', 'tasks', 'goals', 'profile']
    : undefined

  const content = await chatCompletion([
    {
      role: 'system',
      content: withUserContext(systemPrompt, {
        query: memoryQuery,
        domains: memoryDomains,
        maxEntries: 5,
      }),
    },
    {
      role: 'user',
      content: [
        `Focus: ${snapshot.focus}`,
        `Money: ${snapshot.money}`,
        `Habits: ${snapshot.habits}`,
        `Tasks: ${snapshot.tasks}`,
        `Journal: ${snapshot.journal}`,
        snapshot.goal ? `Goal: ${snapshot.goal}` : '',
        snapshot.risks.length > 0 ? `Risks (lead with these): ${snapshot.risks.join(' | ')}` : 'Risks: none',
      ].filter(Boolean).join('\n'),
    },
  ], { temperature: 0.35, max_tokens: 110 })

  const oneLine = content.replace(/\s+/g, ' ').trim()
  return oneLine || buildHomeStoryFallback(snapshot)
}
