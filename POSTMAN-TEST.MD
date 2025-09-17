# Auth0 Multi-Tenancy Management API - Postman Test Collection

This document provides comprehensive test scenarios for the Auth0 Multi-Tenancy Management API. Use this guide to test all API endpoints with proper headers, request bodies, and expected responses.

## 📋 Table of Contents

- [Environment Setup](#environment-setup)
- [Authentication](#authentication)
- [Health & Status Endpoints](#health--status-endpoints)
- [Tenant Management](#tenant-management)
- [User Management](#user-management)
- [Error Scenarios](#error-scenarios)
- [Test Data](#test-data)

## 🔧 Environment Setup

### Base Configuration

Create a Postman environment with the following variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `base_url` | API base URL | `http://localhost:3000` |
| `master_admin_token` | Master admin JWT token | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `tenant_admin_token` | Tenant admin JWT token | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `user_token` | Regular user JWT token | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `test_tenant_id` | Test tenant ID | `tenant_123` |
| `test_user_id` | Test user ID | `auth0|507f1f77bcf86cd799439011` |

### Headers

All requests should include these headers:

```
Content-Type: application/json
Authorization: Bearer {{master_admin_token}}
```

## 🔐 Authentication

### Get M2M Token

**Endpoint:** `POST https://{{auth0_domain}}/oauth/token`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "client_id": "{{m2m_client_id}}",
  "client_secret": "{{m2m_client_secret}}",
  "audience": "{{management_api_audience}}",
  "grant_type": "client_credentials"
}
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

## 🏥 Health & Status Endpoints

### 1. Basic Health Check

**Method:** `GET`  
**URL:** `{{base_url}}/api/health`  
**Headers:** None (public endpoint)

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "api": "operational",
    "auth0": "operational"
  }
}
```

### 2. Detailed Health Check

**Method:** `GET`  
**URL:** `{{base_url}}/api/health/detailed`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development",
  "system": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "arch": "x64",
    "memory": {
      "used": 45,
      "total": 128,
      "external": 12
    },
    "cpu": {
      "loadAverage": [0.5, 0.3, 0.2]
    }
  },
  "services": {
    "auth0": {
      "status": "operational",
      "responseTime": 150,
      "lastCheck": "2024-12-01T10:00:00.000Z"
    },
    "tenantService": {
      "status": "operational",
      "lastCheck": "2024-12-01T10:00:00.000Z"
    }
  },
  "checks": [
    {
      "name": "Auth0 Management API",
      "status": "pass",
      "responseTime": 150
    }
  ],
  "responseTime": 200
}
```

### 3. System Status

**Method:** `GET`  
**URL:** `{{base_url}}/api/status`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-12-01T10:00:00.000Z",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "development",
    "system": {
      "nodeVersion": "v18.17.0",
      "platform": "linux",
      "arch": "x64",
      "pid": 12345,
      "memory": {
        "used": 45,
        "total": 128,
        "external": 12,
        "rss": 67
      },
      "cpu": {
        "loadAverage": [0.5, 0.3, 0.2],
        "usage": {
          "user": 1000000,
          "system": 500000
        }
      }
    },
    "configuration": {
      "port": 3000,
      "logLevel": "info",
      "rateLimitWindow": 900000,
      "rateLimitMax": 100,
      "defaultSeatLimit": 10,
      "maxSeatLimit": 1000
    },
    "features": {
      "tenantCreation": true,
      "userManagement": true,
      "seatManagement": true,
      "auditLogging": true
    },
    "statistics": {
      "tenants": {
        "total": 5,
        "totalSeatsAllocated": 150,
        "totalSeatsUsed": 45,
        "averageUtilization": 30
      }
    }
  },
  "message": "System status retrieved successfully"
}
```

### 4. Version Information

**Method:** `GET`  
**URL:** `{{base_url}}/api/version`  
**Headers:** None (public endpoint)

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "name": "Auth0 Multi-Tenancy Management API",
    "description": "A proxy API for managing Auth0 tenants and users with seat-based licensing",
    "environment": "development",
    "nodeVersion": "v18.17.0",
    "buildDate": "2024-12-01T00:00:00.000Z",
    "commit": "abc123def456"
  },
  "message": "Version information retrieved successfully"
}
```

### 5. Health Test

**Method:** `POST`  
**URL:** `{{base_url}}/api/health/test`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-12-01T10:00:00.000Z",
    "tests": [
      {
        "name": "Basic API Response",
        "status": "pass",
        "duration": 1
      },
      {
        "name": "Auth0 Connectivity",
        "status": "pass",
        "duration": 150
      },
      {
        "name": "Service Instantiation",
        "status": "pass",
        "duration": 1
      }
    ]
  },
  "message": "All tests passed"
}
```

## 🏢 Tenant Management

### 1. List All Tenants

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants?page=1&limit=10&search=&status=active&sortBy=createdAt&sortOrder=desc`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "tenant_123",
        "name": "Acme Corp",
        "domain": "acme-corp",
        "status": "active",
        "plan": "premium",
        "seatLimit": 50,
        "seatUsed": 12,
        "industry": "Technology",
        "contactEmail": "admin@acme-corp.com",
        "createdAt": "2024-11-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  },
  "message": "Retrieved 1 tenants"
}
```

### 2. Create New Tenant

**Method:** `POST`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Tech Startup Inc",
  "domain": "tech-startup",
  "seatLimit": 25,
  "plan": "standard",
  "industry": "Technology",
  "contactEmail": "admin@techstartup.com",
  "allowUserRegistration": true,
  "requireEmailVerification": true,
  "enableMFA": false,
  "sessionTimeout": 24,
  "metadata": {
    "companySize": "startup",
    "region": "US"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_456",
      "name": "Tech Startup Inc",
      "domain": "tech-startup",
      "status": "active",
      "plan": "standard",
      "seatLimit": 25,
      "seatUsed": 0,
      "industry": "Technology",
      "contactEmail": "admin@techstartup.com",
      "allowUserRegistration": true,
      "requireEmailVerification": true,
      "enableMFA": false,
      "sessionTimeout": 24,
      "metadata": {
        "companySize": "startup",
        "region": "US"
      },
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "Tenant created successfully"
}
```

### 3. Get Tenant Details

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_123",
      "name": "Acme Corp",
      "domain": "acme-corp",
      "status": "active",
      "plan": "premium",
      "seatLimit": 50,
      "seatUsed": 12,
      "industry": "Technology",
      "contactEmail": "admin@acme-corp.com",
      "allowUserRegistration": true,
      "requireEmailVerification": true,
      "enableMFA": true,
      "sessionTimeout": 24,
      "metadata": {
        "companySize": "enterprise",
        "region": "US"
      },
      "createdAt": "2024-11-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "Tenant retrieved successfully"
}
```

### 4. Update Tenant

**Method:** `PUT`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Acme Corporation",
  "seatLimit": 75,
  "plan": "enterprise",
  "enableMFA": true,
  "metadata": {
    "companySize": "enterprise",
    "region": "US",
    "updatedBy": "admin"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_123",
      "name": "Acme Corporation",
      "domain": "acme-corp",
      "status": "active",
      "plan": "enterprise",
      "seatLimit": 75,
      "seatUsed": 12,
      "industry": "Technology",
      "contactEmail": "admin@acme-corp.com",
      "allowUserRegistration": true,
      "requireEmailVerification": true,
      "enableMFA": true,
      "sessionTimeout": 24,
      "metadata": {
        "companySize": "enterprise",
        "region": "US",
        "updatedBy": "admin"
      },
      "createdAt": "2024-11-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "Tenant updated successfully"
}
```

### 5. Get Tenant Statistics

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}/stats`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 12,
      "activeUsers": 10,
      "blockedUsers": 2,
      "seatUtilization": 24,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "userGrowth": {
        "thisMonth": 3,
        "lastMonth": 2
      }
    }
  },
  "message": "Tenant statistics retrieved successfully"
}
```

### 6. Update Tenant Seat Limit

**Method:** `PUT`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}/seat-limit`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "seatLimit": 100
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_123",
      "name": "Acme Corporation",
      "domain": "acme-corp",
      "status": "active",
      "plan": "enterprise",
      "seatLimit": 100,
      "seatUsed": 12,
      "industry": "Technology",
      "contactEmail": "admin@acme-corp.com",
      "createdAt": "2024-11-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "Tenant seat limit updated successfully"
}
```

### 7. Get Tenant Seat Usage

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}/seat-usage`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "seatUsage": {
      "totalSeats": 100,
      "usedSeats": 12,
      "availableSeats": 88,
      "utilizationPercentage": 12
    },
    "seatReport": {
      "activeUsers": 10,
      "blockedUsers": 2,
      "pendingUsers": 0,
      "lastUpdated": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "Tenant seat usage retrieved successfully"
}
```

### 8. Validate Tenant Access

**Method:** `POST`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}/validate-access`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "userRole": "tenant_admin",
    "tenantId": "tenant_123",
    "permissions": [
      "user:read",
      "user:create",
      "user:update",
      "user:delete"
    ]
  },
  "message": "Tenant access validation completed"
}
```

### 9. Delete Tenant

**Method:** `DELETE`  
**URL:** `{{base_url}}/api/tenants/{{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "tenantId": "tenant_123",
    "cleanup": {
      "usersDeleted": 12,
      "applicationsDeleted": 1,
      "resourcesCleaned": true
    }
  },
  "message": "Tenant deleted successfully"
}
```

## 👥 User Management

### 1. List Users in Tenant

**Method:** `GET`  
**URL:** `{{base_url}}/api/users?tenantId={{test_tenant_id}}&page=1&limit=10&search=&role=&status=active&sortBy=createdAt&sortOrder=desc`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "auth0|507f1f77bcf86cd799439011",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "roles": ["user"],
        "status": "active",
        "emailVerified": true,
        "lastLogin": "2024-12-01T09:30:00.000Z",
        "createdAt": "2024-11-15T10:00:00.000Z",
        "updatedAt": "2024-12-01T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  },
  "message": "Retrieved 1 users"
}
```

### 2. Create New User

**Method:** `POST`  
**URL:** `{{base_url}}/api/users`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "{{test_tenant_id}}",
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "password": "SecurePassword123!",
  "roles": ["user"],
  "emailVerified": false,
  "connection": "Username-Password-Authentication",
  "user_metadata": {
    "department": "Engineering",
    "position": "Developer"
  },
  "app_metadata": {
    "tenantId": "{{test_tenant_id}}",
    "roles": ["user"]
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439012",
      "email": "jane.smith@example.com",
      "name": "Jane Smith",
      "roles": ["user"],
      "status": "active",
      "emailVerified": false,
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z",
      "user_metadata": {
        "department": "Engineering",
        "position": "Developer"
      },
      "app_metadata": {
        "tenantId": "{{test_tenant_id}}",
        "roles": ["user"]
      }
    }
  },
  "message": "User created successfully"
}
```

### 3. Get User Details

**Method:** `GET`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}?tenantId={{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "roles": ["user"],
      "status": "active",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T09:30:00.000Z",
      "user_metadata": {
        "department": "Sales",
        "position": "Manager"
      },
      "app_metadata": {
        "tenantId": "{{test_tenant_id}}",
        "roles": ["user"]
      }
    }
  },
  "message": "User retrieved successfully"
}
```

### 4. Update User

**Method:** `PUT`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "{{test_tenant_id}}",
  "name": "John Doe Updated",
  "emailVerified": true,
  "user_metadata": {
    "department": "Sales",
    "position": "Senior Manager",
    "phone": "+1-555-0123"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe Updated",
      "roles": ["user"],
      "status": "active",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z",
      "user_metadata": {
        "department": "Sales",
        "position": "Senior Manager",
        "phone": "+1-555-0123"
      },
      "app_metadata": {
        "tenantId": "{{test_tenant_id}}",
        "roles": ["user"]
      }
    }
  },
  "message": "User updated successfully"
}
```

### 5. Get User Roles

**Method:** `GET`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}/roles?tenantId={{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "auth0|507f1f77bcf86cd799439011",
    "roles": ["user"],
    "permissions": [
      "profile:read",
      "profile:update"
    ]
  },
  "message": "User roles retrieved successfully"
}
```

### 6. Update User Roles

**Method:** `PUT`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}/roles`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "{{test_tenant_id}}",
  "roles": ["user", "user_manager"]
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "auth0|507f1f77bcf86cd799439011",
    "previousRoles": ["user"],
    "newRoles": ["user", "user_manager"],
    "permissions": [
      "profile:read",
      "profile:update",
      "user:read",
      "user:create",
      "user:update"
    ]
  },
  "message": "User roles updated successfully"
}
```

### 7. Get Current User Profile

**Method:** `GET`  
**URL:** `{{base_url}}/api/users/me`  
**Headers:**
```
Authorization: Bearer {{user_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "roles": ["user"],
      "status": "active",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T09:30:00.000Z",
      "user_metadata": {
        "department": "Sales",
        "position": "Senior Manager"
      }
    }
  },
  "message": "User profile retrieved successfully"
}
```

### 8. Update Current User Profile

**Method:** `PUT`  
**URL:** `{{base_url}}/api/users/me`  
**Headers:**
```
Authorization: Bearer {{user_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "John Doe Updated",
  "user_metadata": {
    "department": "Sales",
    "position": "Senior Manager",
    "phone": "+1-555-0123"
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe Updated",
      "roles": ["user"],
      "status": "active",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z",
      "user_metadata": {
        "department": "Sales",
        "position": "Senior Manager",
        "phone": "+1-555-0123"
      }
    }
  },
  "message": "Profile updated successfully"
}
```

### 9. Get User Statistics

**Method:** `GET`  
**URL:** `{{base_url}}/api/users/stats?tenantId={{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 12,
      "activeUsers": 10,
      "blockedUsers": 2,
      "pendingUsers": 0,
      "emailVerifiedUsers": 8,
      "usersByRole": {
        "user": 8,
        "admin": 2,
        "tenant_admin": 1,
        "user_manager": 1
      },
      "lastLogin": "2024-12-01T09:30:00.000Z"
    }
  },
  "message": "User statistics retrieved successfully"
}
```

### 10. Block User

**Method:** `POST`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}/block`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "{{test_tenant_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "roles": ["user"],
      "status": "blocked",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "User blocked successfully"
}
```

### 11. Unblock User

**Method:** `POST`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}/unblock`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "{{test_tenant_id}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "auth0|507f1f77bcf86cd799439011",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "roles": ["user"],
      "status": "active",
      "emailVerified": true,
      "lastLogin": "2024-12-01T09:30:00.000Z",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  },
  "message": "User unblocked successfully"
}
```

### 12. Delete User

**Method:** `DELETE`  
**URL:** `{{base_url}}/api/users/{{test_user_id}}?tenantId={{test_tenant_id}}`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "userId": "auth0|507f1f77bcf86cd799439011",
    "cleanup": {
      "sessionsRevoked": true,
      "tokensRevoked": true
    }
  },
  "message": "User deleted successfully"
}
```

## ❌ Error Scenarios

### 1. Unauthorized Access

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:** None

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No authorization token provided",
    "statusCode": 401,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### 2. Invalid Token

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:**
```
Authorization: Bearer invalid_token
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "statusCode": 401,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### 3. Insufficient Permissions

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:**
```
Authorization: Bearer {{user_token}}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Master admin role required for this operation",
    "statusCode": 403,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### 4. Validation Error

**Method:** `POST`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "A",
  "domain": "invalid domain name!"
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body validation failed",
    "statusCode": 400,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789",
    "validationErrors": [
      {
        "field": "name",
        "message": "Tenant name must be at least 2 characters long",
        "value": "A"
      },
      {
        "field": "domain",
        "message": "Domain must contain only lowercase letters, numbers, and hyphens",
        "value": "invalid domain name!"
      }
    ]
  }
}
```

### 5. Resource Not Found

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants/nonexistent_tenant`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant not found",
    "statusCode": 404,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### 6. Rate Limit Exceeded

**Method:** `GET`  
**URL:** `{{base_url}}/api/tenants`  
**Headers:**
```
Authorization: Bearer {{master_admin_token}}
```

**Expected Response (after exceeding rate limit):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests from this IP, please try again later.",
    "statusCode": 429
  }
}
```

### 7. Missing Tenant ID

**Method:** `GET`  
**URL:** `{{base_url}}/api/users`  
**Headers:**
```
Authorization: Bearer {{tenant_admin_token}}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tenant ID is required in query parameters",
    "statusCode": 400,
    "timestamp": "2024-12-01T10:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

## 📊 Test Data

### Sample Tenant Data

```json
{
  "name": "Test Company",
  "domain": "test-company",
  "seatLimit": 50,
  "plan": "premium",
  "industry": "Technology",
  "contactEmail": "admin@testcompany.com",
  "allowUserRegistration": true,
  "requireEmailVerification": true,
  "enableMFA": true,
  "sessionTimeout": 24,
  "metadata": {
    "companySize": "medium",
    "region": "US",
    "testData": true
  }
}
```

### Sample User Data

```json
{
  "tenantId": "tenant_123",
  "email": "test.user@example.com",
  "name": "Test User",
  "password": "TestPassword123!",
  "roles": ["user"],
  "emailVerified": false,
  "connection": "Username-Password-Authentication",
  "user_metadata": {
    "department": "QA",
    "position": "Tester",
    "testData": true
  },
  "app_metadata": {
    "tenantId": "tenant_123",
    "roles": ["user"],
    "testData": true
  }
}
```

## 🔧 Postman Collection Setup

### Pre-request Scripts

Add this to your collection's pre-request script to automatically set the base URL:

```javascript
// Set base URL if not already set
if (!pm.environment.get("base_url")) {
    pm.environment.set("base_url", "http://localhost:3000");
}
```

### Test Scripts

Add this to your collection's test script to validate common response patterns:

```javascript
// Common response validation
pm.test("Response has success field", function () {
    pm.expect(pm.response.json()).to.have.property('success');
});

pm.test("Response has message field", function () {
    pm.expect(pm.response.json()).to.have.property('message');
});

pm.test("Response time is less than 5000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});

// Success response validation
if (pm.response.json().success === true) {
    pm.test("Success response has data field", function () {
        pm.expect(pm.response.json()).to.have.property('data');
    });
}

// Error response validation
if (pm.response.json().success === false) {
    pm.test("Error response has error field", function () {
        pm.expect(pm.response.json()).to.have.property('error');
    });
    
    pm.test("Error response has required error fields", function () {
        const error = pm.response.json().error;
        pm.expect(error).to.have.property('code');
        pm.expect(error).to.have.property('message');
        pm.expect(error).to.have.property('statusCode');
        pm.expect(error).to.have.property('timestamp');
    });
}
```

### Environment Variables

Create these environment variables in Postman:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `master_admin_token` | | |
| `tenant_admin_token` | | |
| `user_token` | | |
| `test_tenant_id` | | |
| `test_user_id` | | |
| `auth0_domain` | `your-tenant.auth0.com` | `your-tenant.auth0.com` |
| `m2m_client_id` | | |
| `m2m_client_secret` | | |
| `management_api_audience` | `https://your-tenant.auth0.com/api/v2/` | `https://your-tenant.auth0.com/api/v2/` |

## 📝 Testing Checklist

### Health & Status Endpoints
- [ ] Basic health check (public)
- [ ] Detailed health check (authenticated)
- [ ] System status (master admin)
- [ ] Version information (public)
- [ ] Health test (master admin)

### Tenant Management
- [ ] List tenants with pagination
- [ ] Create new tenant
- [ ] Get tenant details
- [ ] Update tenant
- [ ] Get tenant statistics
- [ ] Update seat limit
- [ ] Get seat usage
- [ ] Validate tenant access
- [ ] Delete tenant

### User Management
- [ ] List users in tenant
- [ ] Create new user
- [ ] Get user details
- [ ] Update user
- [ ] Get user roles
- [ ] Update user roles
- [ ] Get current user profile
- [ ] Update current user profile
- [ ] Get user statistics
- [ ] Block user
- [ ] Unblock user
- [ ] Delete user

### Error Scenarios
- [ ] Unauthorized access
- [ ] Invalid token
- [ ] Insufficient permissions
- [ ] Validation errors
- [ ] Resource not found
- [ ] Rate limit exceeded
- [ ] Missing required parameters

### Security Testing
- [ ] Test with expired tokens
- [ ] Test with malformed tokens
- [ ] Test cross-tenant access
- [ ] Test privilege escalation
- [ ] Test input validation
- [ ] Test rate limiting

## 🚀 Quick Start

1. **Import Environment**: Create a new environment in Postman with the variables listed above
2. **Get M2M Token**: Use the authentication endpoint to get a valid token
3. **Set Tokens**: Update the environment variables with your tokens
4. **Test Health**: Start with the health check endpoints
5. **Create Test Data**: Create a test tenant and user
6. **Run Full Suite**: Execute all test scenarios
7. **Verify Results**: Check that all tests pass and responses match expected formats

## 📚 Additional Resources

- [Auth0 Management API Documentation](https://auth0.com/docs/api/management/v2)
- [JWT Token Validation](https://jwt.io/)
- [Postman Testing Documentation](https://learning.postman.com/docs/writing-scripts/test-scripts/)
- [API Rate Limiting Best Practices](https://auth0.com/blog/rate-limiting/)

---

**Note**: This test collection assumes you have a running instance of the Auth0 Multi-Tenancy Management API with proper Auth0 configuration. Make sure to update the environment variables with your actual Auth0 credentials and API endpoints.
