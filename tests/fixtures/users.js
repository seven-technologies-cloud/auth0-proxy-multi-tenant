/**
 * Test fixtures for user data
 */

const sampleUsers = {
  validUser: {
    email: 'john.doe@acme-corp.com',
    name: 'John Doe',
    password: 'SecurePassword123!',
    roles: ['user'],
    emailVerified: false,
    connection: 'Username-Password-Authentication',
    metadata: {
      department: 'engineering',
      title: 'Senior Developer',
      startDate: '2024-01-15',
    },
    appMetadata: {
      customField: 'custom-value',
    },
  },

  adminUser: {
    email: 'admin@acme-corp.com',
    name: 'Admin User',
    password: 'AdminPassword123!',
    roles: ['admin', 'tenant_admin'],
    emailVerified: true,
    connection: 'Username-Password-Authentication',
    metadata: {
      department: 'administration',
      title: 'System Administrator',
      startDate: '2024-01-01',
    },
  },

  managerUser: {
    email: 'manager@acme-corp.com',
    name: 'Manager User',
    password: 'ManagerPassword123!',
    roles: ['user', 'user_manager'],
    emailVerified: true,
    connection: 'Username-Password-Authentication',
    metadata: {
      department: 'management',
      title: 'Team Manager',
      startDate: '2024-01-10',
    },
  },

  invalidUser: {
    email: 'invalid-email', // Invalid email format
    name: '', // Empty name
    password: '123', // Too short password
    roles: 'not-an-array', // Should be array
  },

  userWithMinimalData: {
    email: 'minimal@example.com',
    name: 'Minimal User',
  },

  userForUpdate: {
    name: 'John Doe Updated',
    metadata: {
      department: 'engineering',
      title: 'Lead Developer',
      updated: true,
    },
  },
};

const createdUsers = {
  johnDoe: {
    id: 'user_john_123',
    tenantId: 'tenant_acme_123',
    auth0UserId: 'auth0|user_john_123',
    email: 'john.doe@acme-corp.com',
    name: 'John Doe',
    picture: 'https://gravatar.com/avatar/johndoe',
    roles: ['user'],
    status: 'active',
    lastLogin: new Date('2024-01-24T14:30:00.000Z'),
    loginCount: 15,
    metadata: {
      department: 'engineering',
      title: 'Senior Developer',
      startDate: '2024-01-15',
    },
    appMetadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['user'],
    },
    emailVerified: true,
    createdAt: new Date('2024-01-16T09:00:00.000Z'),
    updatedAt: new Date('2024-01-24T14:30:00.000Z'),
  },

  adminUser: {
    id: 'user_admin_456',
    tenantId: 'tenant_acme_123',
    auth0UserId: 'auth0|user_admin_456',
    email: 'admin@acme-corp.com',
    name: 'Admin User',
    picture: 'https://gravatar.com/avatar/adminuser',
    roles: ['admin', 'tenant_admin'],
    status: 'active',
    lastLogin: new Date('2024-01-25T08:15:00.000Z'),
    loginCount: 45,
    metadata: {
      department: 'administration',
      title: 'System Administrator',
      startDate: '2024-01-01',
    },
    appMetadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['admin', 'tenant_admin'],
    },
    emailVerified: true,
    createdAt: new Date('2024-01-01T10:00:00.000Z'),
    updatedAt: new Date('2024-01-25T08:15:00.000Z'),
  },

  blockedUser: {
    id: 'user_blocked_789',
    tenantId: 'tenant_acme_123',
    auth0UserId: 'auth0|user_blocked_789',
    email: 'blocked@acme-corp.com',
    name: 'Blocked User',
    picture: null,
    roles: ['user'],
    status: 'blocked',
    lastLogin: new Date('2024-01-20T12:00:00.000Z'),
    loginCount: 3,
    metadata: {
      department: 'sales',
      title: 'Sales Rep',
      blockedReason: 'policy_violation',
    },
    appMetadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['user'],
    },
    emailVerified: true,
    createdAt: new Date('2024-01-18T14:30:00.000Z'),
    updatedAt: new Date('2024-01-22T16:45:00.000Z'),
  },

  pendingUser: {
    id: 'user_pending_101',
    tenantId: 'tenant_acme_123',
    auth0UserId: 'auth0|user_pending_101',
    email: 'pending@acme-corp.com',
    name: 'Pending User',
    picture: null,
    roles: ['user'],
    status: 'pending',
    lastLogin: null,
    loginCount: 0,
    metadata: {
      department: 'marketing',
      title: 'Marketing Specialist',
    },
    appMetadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['user'],
    },
    emailVerified: false,
    createdAt: new Date('2024-01-25T10:00:00.000Z'),
    updatedAt: new Date('2024-01-25T10:00:00.000Z'),
  },

  differentTenantUser: {
    id: 'user_beta_202',
    tenantId: 'tenant_beta_456',
    auth0UserId: 'auth0|user_beta_202',
    email: 'user@beta-solutions.com',
    name: 'Beta User',
    picture: 'https://gravatar.com/avatar/betauser',
    roles: ['user'],
    status: 'active',
    lastLogin: new Date('2024-01-24T16:20:00.000Z'),
    loginCount: 8,
    metadata: {
      department: 'finance',
      title: 'Financial Analyst',
    },
    appMetadata: {
      tenant_id: 'tenant_beta_456',
      roles: ['user'],
    },
    emailVerified: true,
    createdAt: new Date('2024-01-12T11:30:00.000Z'),
    updatedAt: new Date('2024-01-24T16:20:00.000Z'),
  },
};

const userListResponse = {
  users: [
    createdUsers.johnDoe,
    createdUsers.adminUser,
    createdUsers.blockedUser,
    createdUsers.pendingUser,
  ],
  pagination: {
    total: 4,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

const userRoles = {
  basic: [
    {
      id: 'rol_user_123',
      name: 'user',
      description: 'Regular user role',
    },
  ],

  admin: [
    {
      id: 'rol_admin_456',
      name: 'admin',
      description: 'Administrator role',
    },
    {
      id: 'rol_tenant_admin_789',
      name: 'tenant_admin',
      description: 'Tenant administrator role',
    },
  ],

  manager: [
    {
      id: 'rol_user_123',
      name: 'user',
      description: 'Regular user role',
    },
    {
      id: 'rol_user_manager_101',
      name: 'user_manager',
      description: 'User manager role',
    },
  ],
};

const userStats = {
  acmeTenant: {
    tenantId: 'tenant_acme_123',
    totalUsers: 4,
    activeUsers: 3,
    blockedUsers: 1,
    pendingUsers: 1,
    verifiedUsers: 3,
    recentLogins: 2,
    roleDistribution: {
      user: 3,
      admin: 1,
      tenant_admin: 1,
    },
    averageLoginCount: 15.75,
  },

  betaTenant: {
    tenantId: 'tenant_beta_456',
    totalUsers: 1,
    activeUsers: 1,
    blockedUsers: 0,
    pendingUsers: 0,
    verifiedUsers: 1,
    recentLogins: 1,
    roleDistribution: {
      user: 1,
    },
    averageLoginCount: 8,
  },
};

const auth0UserResponses = {
  validUser: {
    user_id: 'auth0|user_john_123',
    email: 'john.doe@acme-corp.com',
    name: 'John Doe',
    picture: 'https://gravatar.com/avatar/johndoe',
    created_at: '2024-01-16T09:00:00.000Z',
    updated_at: '2024-01-24T14:30:00.000Z',
    last_login: '2024-01-24T14:30:00.000Z',
    logins_count: 15,
    email_verified: true,
    blocked: false,
    user_metadata: {
      department: 'engineering',
      title: 'Senior Developer',
      startDate: '2024-01-15',
    },
    app_metadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['user'],
    },
  },

  adminUser: {
    user_id: 'auth0|user_admin_456',
    email: 'admin@acme-corp.com',
    name: 'Admin User',
    picture: 'https://gravatar.com/avatar/adminuser',
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-25T08:15:00.000Z',
    last_login: '2024-01-25T08:15:00.000Z',
    logins_count: 45,
    email_verified: true,
    blocked: false,
    user_metadata: {
      department: 'administration',
      title: 'System Administrator',
      startDate: '2024-01-01',
    },
    app_metadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['admin', 'tenant_admin'],
    },
  },

  blockedUser: {
    user_id: 'auth0|user_blocked_789',
    email: 'blocked@acme-corp.com',
    name: 'Blocked User',
    created_at: '2024-01-18T14:30:00.000Z',
    updated_at: '2024-01-22T16:45:00.000Z',
    last_login: '2024-01-20T12:00:00.000Z',
    logins_count: 3,
    email_verified: true,
    blocked: true,
    user_metadata: {
      department: 'sales',
      title: 'Sales Rep',
      blockedReason: 'policy_violation',
    },
    app_metadata: {
      tenant_id: 'tenant_acme_123',
      roles: ['user'],
    },
  },
};

module.exports = {
  sampleUsers,
  createdUsers,
  userListResponse,
  userRoles,
  userStats,
  auth0UserResponses,
};