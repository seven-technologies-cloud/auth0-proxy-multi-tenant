const express = require('express');
const tenantRoutes = require('./tenants');
const userRoutes = require('./users');
const healthRoutes = require('./health');

const router = express.Router();

// API Routes (M2M Only - No user authentication)
router.use('/tenants', tenantRoutes);
router.use('/users', userRoutes);
router.use('/health', healthRoutes);
router.use('/status', healthRoutes); // Alias for health routes

// API Info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Auth0 Multi-Tenancy Management API',
      version: process.env.npm_package_version || '1.0.0',
      description: 'A proxy API for managing Auth0 tenants and users with seat-based licensing',
      endpoints: {
        tenants: '/api/tenants',
        users: '/api/users',
        health: '/api/health',
        status: '/api/status',
        version: '/api/version',
      },
      documentation: process.env.API_DOCS_ENABLED !== 'false' ? '/docs' : null,
    },
    message: 'Auth0 Proxy API is running',
  });
});

module.exports = router;