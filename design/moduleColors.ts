// One identity color per module, retuned to the UI1.png "Personal OS Console"
// palette: Finance = blue, Habits = green, Journal = amber, Reminders = soft teal,
// Analysis/Focus = indigo. Module identity never reuses the semantic money
// colors (income green / expense red) — Finance is blue, Habits a teal-green.
export const MODULE_COLORS = {
  finance: '#4B7CF3',
  habits: '#28B985',
  journal: '#F09A2F',
  tasks: '#0EA5A8',
  analysis: '#5F62D9',
} as const

export const MODULE_ICONS = {
  finance: 'trending-up',
  habits: 'check-circle',
  journal: 'book-open',
  tasks: 'bell',
  goals: 'target',
  analysis: 'bar-chart-2',
  search: 'search',
} as const

// Soft tint background for a module-colored icon chip (matches UI1 list rows).
export const moduleTint = (hex: string) => hex + '1A'
