// One identity color per module. Finance previously borrowed the semantic
// expense red (tab bar) AND income green (add sheet) — module identity must
// never reuse semantic money colors, so it gets its own deep green.
export const MODULE_COLORS = {
  finance: '#3E7C59',
  tasks: '#4C6F91',
  habits: '#C9853E',
  journal: '#7D5A86',
  analysis: '#5E756E',
} as const
