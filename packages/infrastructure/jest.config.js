module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@bas/core$': '<rootDir>/../core/src',
    '^@bas/infrastructure$': '<rootDir>/../infrastructure/src',
    '^@bas/orchestration$': '<rootDir>/../orchestration/src'
  }
};
