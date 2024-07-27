module.exports = {
  // Only include TypeScript test files from the tests folder
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  verbose: true,
  testTimeout: 10000,
  collectCoverage: true,
  coverageDirectory: './coverage', // Ensure this directory is writeable and exists
  coverageReporters: ['json', 'lcov', 'text', 'text-summary', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
