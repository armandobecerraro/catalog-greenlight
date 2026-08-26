module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@bas/core$': '<rootDir>/packages/core/src',
    '^@bas/infrastructure$': '<rootDir>/packages/infrastructure/src',
    '^@bas/orchestration$': '<rootDir>/packages/orchestration/src',
    '^@bas/api$': '<rootDir>/packages/api/src'
  }
};
