/**
 * Test fixtures for tenant data
 */

const sampleTenants = {
  validTenant: {
    name: 'Acme Corporation',
    domain: 'acme-corp',
    seatLimit: 50,
    plan: 'premium',
    industry: 'technology',
    contactEmail: 'admin@acme-corp.com',
    allowUserRegistration: true,
    requireEmailVerification: true,
    enableMFA: false,
    sessionTimeout: 24,
    metadata: {
      companySize: 'medium',
      region: 'us-east',
      customField: 'custom-value',
    },
  },

  anotherValidTenant: {
    name: 'Beta Solutions',
    domain: 'beta-solutions',
    seatLimit: 25,
    plan: 'standard',
    industry: 'finance',
    contactEmail: 'contact@beta-solutions.com',
    allowUserRegistration: false,
    requireEmailVerification: true,
    enableMFA: true,
    sessionTimeout: 12,
    metadata: {
      companySize: 'small',
      region: 'eu-west',
    },
  },

  largeTenant: {
    name: 'Enterprise Corp',
    domain: 'enterprise-corp',
    seatLimit: 500,
    plan: 'enterprise',
    industry: 'manufacturing',
    contactEmail: 'admin@enterprise-corp.com',
    allowUserRegistration: true,
    requireEmailVerification: true,
    enableMFA: true,
    sessionTimeout: 8,
    metadata: {
      companySize: 'large',
      region: 'global',
      compliance: 'SOX',
    },
  },

  invalidTenant: {
    name: '', // Invalid: empty name
    domain: 'Invalid Domain!', // Invalid: contains spaces and special chars
    seatLimit: -5, // Invalid: negative seat limit
    plan: 'invalid-plan', // Invalid: not a valid plan
  },

  tenantWithMinimalData: {
    name: 'Minimal Corp',
    domain: 'minimal-corp',
    seatLimit: 10,
  },

  tenantForUpdate: {
    name: 'Updated Corporation Name',
    seatLimit: 75,
    plan: 'enterprise',
    metadata: {
      updated: true,
      newField: 'new-value',
    },
  },
};

const createdTenants = {
  acmeCorp: {
    id: 'tenant_acme_123',
    name: 'Acme Corporation',
    domain: 'acme-corp.auth0.com',
    auth0ClientId: 'client_acme_123',
    auth0ClientSecret: 'secret_acme_123',
    seatLimit: 50,
    seatUsed: 23,
    status: 'active',
    metadata: {
      plan: 'premium',
      industry: 'technology',
      createdBy: 'master_admin_123',
    },
    settings: {
      allowUserRegistration: true,
      requireEmailVerification: true,
      enableMFA: false,
      sessionTimeout: 24,
    },
    createdAt: new Date('2024-01-15T10:30:00.000Z'),
    updatedAt: new Date('2024-01-20T14:45:00.000Z'),
  },

  betaSolutions: {
    id: 'tenant_beta_456',
    name: 'Beta Solutions',
    domain: 'beta-solutions.auth0.com',
    auth0ClientId: 'client_beta_456',
    auth0ClientSecret: 'secret_beta_456',
    seatLimit: 25,
    seatUsed: 12,
    status: 'active',
    metadata: {
      plan: 'standard',
      industry: 'finance',
      createdBy: 'master_admin_123',
    },
    settings: {
      allowUserRegistration: false,
      requireEmailVerification: true,
      enableMFA: true,
      sessionTimeout: 12,
    },
    createdAt: new Date('2024-01-10T08:15:00.000Z'),
    updatedAt: new Date('2024-01-18T16:20:00.000Z'),
  },

  suspendedTenant: {
    id: 'tenant_suspended_789',
    name: 'Suspended Corp',
    domain: 'suspended-corp.auth0.com',
    auth0ClientId: 'client_suspended_789',
    auth0ClientSecret: 'secret_suspended_789',
    seatLimit: 30,
    seatUsed: 5,
    status: 'suspended',
    metadata: {
      plan: 'standard',
      industry: 'retail',
      createdBy: 'master_admin_123',
      suspendedReason: 'payment_overdue',
    },
    settings: {
      allowUserRegistration: false,
      requireEmailVerification: true,
      enableMFA: false,
      sessionTimeout: 24,
    },
    createdAt: new Date('2024-01-05T12:00:00.000Z'),
    updatedAt: new Date('2024-01-25T09:30:00.000Z'),
  },
};

const tenantStats = {
  acmeCorp: {
    tenantId: 'tenant_acme_123',
    totalUsers: 23,
    activeUsers: 20,
    blockedUsers: 2,
    pendingUsers: 1,
    seatUtilization: 46,
    lastUserCreated: new Date('2024-01-24T16:20:00.000Z'),
    lastLogin: new Date('2024-01-25T08:45:00.000Z'),
    createdAt: new Date('2024-01-15T10:30:00.000Z'),
    status: 'active',
  },

  betaSolutions: {
    tenantId: 'tenant_beta_456',
    totalUsers: 12,
    activeUsers: 11,
    blockedUsers: 1,
    pendingUsers: 0,
    seatUtilization: 48,
    lastUserCreated: new Date('2024-01-22T14:10:00.000Z'),
    lastLogin: new Date('2024-01-25T07:30:00.000Z'),
    createdAt: new Date('2024-01-10T08:15:00.000Z'),
    status: 'active',
  },
};

const tenantListResponse = {
  tenants: [createdTenants.acmeCorp, createdTenants.betaSolutions],
  pagination: {
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

const seatUsageData = {
  acmeCorp: {
    tenantId: 'tenant_acme_123',
    seatLimit: 50,
    seatUsed: 23,
    availableSeats: 27,
    utilizationPercentage: 46,
    lastUpdated: new Date('2024-01-25T10:00:00.000Z'),
  },

  betaSolutions: {
    tenantId: 'tenant_beta_456',
    seatLimit: 25,
    seatUsed: 12,
    availableSeats: 13,
    utilizationPercentage: 48,
    lastUpdated: new Date('2024-01-25T09:30:00.000Z'),
  },

  nearLimit: {
    tenantId: 'tenant_near_limit_999',
    seatLimit: 10,
    seatUsed: 9,
    availableSeats: 1,
    utilizationPercentage: 90,
    lastUpdated: new Date('2024-01-25T11:00:00.000Z'),
  },

  atLimit: {
    tenantId: 'tenant_at_limit_888',
    seatLimit: 20,
    seatUsed: 20,
    availableSeats: 0,
    utilizationPercentage: 100,
    lastUpdated: new Date('2024-01-25T11:15:00.000Z'),
  },
};

module.exports = {
  sampleTenants,
  createdTenants,
  tenantStats,
  tenantListResponse,
  seatUsageData,
};