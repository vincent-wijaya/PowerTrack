module.exports = {
  // Only include TypeScript test files
  testMatch: [
    "**/*.test.ts"
  ],
  preset: "ts-jest",
  testEnvironment: "node",
  // Optional: Configure the TypeScript compiler
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
