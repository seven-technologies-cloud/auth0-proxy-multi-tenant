const dotenv = require('dotenv');
const path = require('path');

module.exports = async function globalSetup() {
  // Load environment variables from .env file
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  
  // Set NODE_ENV to test if not already set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }
  
  // Set test-specific overrides
  process.env.LOG_LEVEL = 'error'; // Minimize logging during tests
  process.env.DETAILED_ERRORS = 'true'; // Enable detailed errors for debugging
  process.env.MOCK_AUTH0_API = 'true'; // Enable Auth0 API mocking
  
  console.log('🧪 Global test setup completed');
  console.log(`📊 Test environment: ${process.env.NODE_ENV}`);
  console.log(`🔧 Auth0 mocking: ${process.env.MOCK_AUTH0_API}`);
};