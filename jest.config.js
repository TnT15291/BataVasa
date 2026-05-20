/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@features/(.*)$': '<rootDir>/features/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@db/(.*)$': '<rootDir>/database/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@design/(.*)$': '<rootDir>/design/$1',
  },
  // Coverage gate (Cross-Module reliability — docs/ops.md#testing).
  // Scope: business logic only (services / DB / per-module services), not UI.
  collectCoverageFrom: [
    'services/**/*.ts',
    'database/**/*.ts',
    'features/**/services.ts',
    '!**/*.d.ts',
    '!services/i18n/translations/**',
  ],
  coverageReporters: ['text-summary', 'text', 'lcov'],
  // Thresholds ratchet UP only — never lower them. Target per docs/ops.md:
  // global services/DB → 70% statements; pure helpers → 90%.
  // Current global is the regression floor; raise as the DB/sync layers get tests.
  coverageThreshold: {
    global: {
      statements: 17,
      branches: 18,
      functions: 13,
      lines: 18,
    },
    // Pure deterministic helpers — locked at the 90% target (docs/ops.md).
    './services/dateParser.ts': { statements: 90, branches: 80, functions: 90, lines: 90 },
    './services/locale.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
    './services/uuid.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
    './services/fx.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
    './services/ai/aiLanguage.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
    './services/ai/reminderParser.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
}
