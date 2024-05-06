module.exports = {
  // Only include TypeScript test files
  testMatch: [
    "**/*.test.ts"
  ],
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  verbose: true,
  testTimeout: 10000,
};
