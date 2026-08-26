module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(langchain|@langchain)/)'
  ],
  moduleNameMapper: {
    '^@bas/core$': '<rootDir>/../core/src',
    '^@bas/infrastructure$': '<rootDir>/../infrastructure/src',
    '^@bas/orchestration$': '<rootDir>/../orchestration/src'
  }
};
