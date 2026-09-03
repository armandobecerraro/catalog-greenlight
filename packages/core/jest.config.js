module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 }
  },
  moduleNameMapper: {
    '^@bas/core$': '<rootDir>/src/index.ts',
    '^@bas/infrastructure$': '<rootDir>/../infrastructure/src/index.ts',
    '^@bas/orchestration$': '<rootDir>/../orchestration/src/index.ts'
  }
};
