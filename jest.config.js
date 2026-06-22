/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  preset: 'ts-jest',
  setupFiles: ['./src/test-setup.ts'],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  testMatch: ["**/tests/**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    // Ignore integration tests that require external servers
    "tests/integration/phase5_runtime_manager.test.ts",
    "tests/integration/phase6_config_loader.test.ts",
    // gRPC binding tests — gRPC surface is currently unhooked
    "tests/unit/grpc/server.test.ts",
    "tests/integration/grpc_client.test.ts"
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
};
