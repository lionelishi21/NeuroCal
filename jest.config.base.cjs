/** Shared Jest setup for TypeScript workspaces (backend, contracts). */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node10",
          verbatimModuleSyntax: false,
          isolatedModules: true,
        },
      },
    ],
  },
};
