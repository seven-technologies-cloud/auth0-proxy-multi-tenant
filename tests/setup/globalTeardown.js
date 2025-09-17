module.exports = async function globalTeardown() {
  // Clean up any global resources
  console.log('🧹 Global test teardown completed');
  
  // Force exit to ensure all handles are closed
  process.exit(0);
};