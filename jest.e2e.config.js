/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.e2e.test.js'],
  // No globalSetup that forces MOCK_AUTH0_API
  setupFilesAfterEnv: [],
  collectCoverage: false,
  verbose: true,
  testTimeout: 15000,
};