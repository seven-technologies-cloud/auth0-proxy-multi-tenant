# Auth0 Multi-Tenancy Management API

A production-ready Node.js API for managing Auth0 multi-tenant applications with seat-based licensing. This proxy API provides a unified interface for managing tenants, users, and seat allocations across multiple Auth0 tenants using Auth0's Management API.

## 🚀 Features

- **Multi-Tenant Architecture**: Manage multiple Auth0 tenants from a single API
- **Seat-Based Licensing**: Track and enforce seat limits per tenant
- **Role-Based Access Control**: Master admin, tenant admin, and user roles
- **JWT Authentication**: Secure authentication using Auth0 JWT tokens
- **Auth0 Management API Integration**: Full integration with Auth0's Management API
- **Machine-to-Machine Authentication**: Secure server-to-server communication
- **Comprehensive User Management**: CRUD operations for users with role management
- **Tenant Management**: Full tenant lifecycle management (Master admin only)
- **Health Monitoring**: Built-in health checks and system status endpoints
- **Request Validation**: Comprehensive input validation using Joi
- **Error Handling**: Structured error responses with detailed logging
- **Rate Limiting**: Configurable rate limiting per user/IP
- **Mock Mode**: Development mode with Auth0 API mocking for testing

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Auth0 Setup](#auth0-setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🔧 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Auth0 Account**: With Management API access
- **Auth0 Machine-to-Machine Application**: For Management API access

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Auth0-Proxy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🔐 Auth0 Setup

### Step 1: Create Machine-to-Machine Application

1. Go to your Auth0 Dashboard
2. Navigate to **Applications** → **Create Application**
3. Choose **Machine to Machine Applications**
4. Select your **Auth0 Management API**
5. Grant the following scopes:
   - `read:users`
   - `create:users`
   - `update:users`
   - `delete:users`
   - `read:clients`
   - `create:clients`
   - `update:clients`
   - `delete:clients`
   - `read:tenant_settings`
   - `update:tenant_settings`

### Step 2: Get Credentials

From your M2M application settings, copy:
- **Domain** (e.g., `your-tenant.auth0.com`)
- **Client ID**
- **Client Secret**

### Why Machine-to-Machine?

**Machine-to-Machine (M2M) applications are the correct choice for this API because:**
- ✅ **Server-to-server communication** (no user interaction)
- ✅ **Management API access** (programmatic Auth0 resource management)
- ✅ **Client Credentials flow** (secure backend authentication)
- ✅ **Tenant and user management** (administrative operations)

**Regular Web Apps or Native Apps are NOT suitable** for this use case as they're designed for user login flows, not backend API operations.

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

#### Required Configuration

```env
# Master Auth0 Tenant Configuration (M2M Application)
MASTER_AUTH0_DOMAIN=your-tenant.auth0.com
MASTER_AUTH0_CLIENT_ID=your_m2m_client_id
MASTER_AUTH0_CLIENT_SECRET=your_m2m_client_secret
MASTER_AUTH0_AUDIENCE=https://your-api-identifier

# Auth0 Management API Configuration
AUTH0_MANAGEMENT_API_AUDIENCE=https://your-tenant.auth0.com/api/v2/
AUTH0_MANAGEMENT_API_SCOPE=read:users create:users update:users delete:users read:clients create:clients update:clients delete:clients read:tenant_settings update:tenant_settings

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

#### Optional Configuration

```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Seat Management
DEFAULT_SEAT_LIMIT=10
MAX_SEAT_LIMIT=1000

# Features
ENABLE_TENANT_CREATION=true
ENABLE_USER_MANAGEMENT=true
ENABLE_SEAT_MANAGEMENT=true

# Development Settings
DEBUG_MODE=false
MOCK_AUTH0_API=false  # Set to true for development without real Auth0 calls
```

## 🚀 Usage

### Starting the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Basic API Usage

1. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Get API Information:**
   ```bash
   curl http://localhost:3000/api
   ```

3. **Create a Tenant** (Master Admin only):
   ```bash
   curl -X POST http://localhost:3000/api/tenants \
     -H "Authorization: Bearer <master_admin_jwt>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Acme Corp",
       "domain": "acme-corp.example.com",
       "seatLimit": 50,
       "callbacks": ["https://acme-corp.example.com/callback"],
       "allowedOrigins": ["https://acme-corp.example.com"],
       "webOrigins": ["https://acme-corp.example.com"]
     }'
   ```

4. **Create a User:**
   ```bash
   curl -X POST http://localhost:3000/api/users \
     -H "Authorization: Bearer <tenant_admin_jwt>" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "name": "John Doe",
       "password": "SecurePassword123!",
       "roles": ["user"]
     }'
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints (except health checks) require a valid JWT token:
```
Authorization: Bearer <jwt_token>
```

### Endpoints Overview

#### Tenant Management (Master Admin Only)
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create a new tenant (creates Auth0 client)
- `GET /api/tenants/:tenantId` - Get tenant details
- `PUT /api/tenants/:tenantId` - Update tenant
- `DELETE /api/tenants/:tenantId` - Delete tenant
- `GET /api/tenants/:tenantId/users` - List users in tenant
- `POST /api/tenants/:tenantId/users` - Create user in tenant

#### User Management
- `GET /api/users` - List users in your tenant
- `POST /api/users` - Create a new user
- `GET /api/users/:userId` - Get user details
- `PUT /api/users/:userId` - Update user
- `DELETE /api/users/:userId` - Delete user
- `GET /api/users/:userId/roles` - Get user roles
- `PUT /api/users/:userId/roles` - Update user roles
- `GET /api/users/me` - Get your profile
- `PUT /api/users/me` - Update your profile

#### Health & Status
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health check (Master Admin)
- `GET /api/status` - System status (Master Admin)
- `GET /api/version` - Version information

### Response Format

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "statusCode": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456789"
  }
}
```

## 🔐 Authentication

### JWT Token Requirements

The API validates JWT tokens from Auth0 tenants. Tokens must include:

- **Issuer (`iss`)**: Must match the Auth0 tenant domain
- **Audience (`aud`)**: Must match the configured audience
- **Subject (`sub`)**: User ID
- **Custom Claims**:
  - `tenant_id`: User's tenant ID
  - `roles`: Array of user roles

### Role-Based Access Control

#### Roles
- **Master Admin**: Full access to all tenants and operations
- **Tenant Admin**: Full access to their own tenant's users
- **User Manager**: Can manage users within their tenant
- **User**: Can view and update their own profile

#### Access Patterns
- **Master Tenant Operations**: Require `master_admin` role
- **Tenant User Management**: Require `tenant_admin`, `admin`, or `user_manager` roles
- **Self Operations**: Users can always access their own profile

## 🏗️ Architecture

### Project Structure
```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
│   ├── auth.js       # JWT authentication
│   ├── authorization.js # Role-based access control
│   ├── errorHandler.js  # Error handling
│   └── validation.js    # Request validation
├── routes/           # API route definitions
│   ├── tenants.js    # Tenant management routes
│   ├── users.js      # User management routes
│   ├── health.js     # Health check routes
│   └── index.js      # Route aggregation
├── services/         # Business logic layer
│   ├── auth0Service.js    # Auth0 Management API wrapper
│   ├── tenantService.js   # Tenant operations
│   ├── userService.js     # User operations
│   └── seatService.js     # Seat management
├── utils/            # Utility functions
│   ├── errors.js     # Custom error classes
│   └── logger.js     # Logging utility
└── app.js            # Express application setup
```

### Key Components

#### Services Layer
- **Auth0Service**: Handles all Auth0 Management API interactions with M2M authentication
- **TenantService**: Manages tenant lifecycle and operations
- **UserService**: Handles user CRUD operations with seat tracking
- **SeatService**: Manages seat allocation and limits

#### Middleware Layer
- **Authentication**: JWT token validation and user context
- **Authorization**: Role-based access control
- **Validation**: Request payload validation using Joi schemas
- **Error Handling**: Centralized error processing and logging

## 🛠️ Development

### Available Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run security tests only
npm run test:security

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Validate code (lint + test)
npm run validate
```

### Development Features

#### Mock Mode
For development without making real Auth0 API calls:
```env
MOCK_AUTH0_API=true
```

This enables:
- Mock Auth0 Management API responses
- In-memory user and tenant storage
- Faster development iteration
- No Auth0 API rate limits

#### Debug Mode
Enable detailed debugging:
```env
DEBUG_MODE=true
LOG_LEVEL=debug
```

## 🧪 Testing

### Test Structure
```
tests/
├── unit/             # Unit tests for services and utilities
├── integration/      # API endpoint integration tests
├── security/         # Authentication and authorization tests
├── e2e/             # End-to-end tests with real Auth0
├── fixtures/        # Test data
├── helpers/         # Test utilities
└── setup/           # Test configuration
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth0Service

# Run E2E tests with real Auth0 (requires valid credentials)
npm run test:e2e
```

### Test Categories

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints and service interactions
- **Security Tests**: Test JWT validation and authorization
- **E2E Tests**: Test with real Auth0 API calls

## 🚀 Deployment

### Environment Setup

1. **Production Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=3000
   LOG_LEVEL=info
   DETAILED_ERRORS=false
   STACK_TRACE_ENABLED=false
   MOCK_AUTH0_API=false
   ```

2. **Security Considerations:**
   - Use HTTPS in production
   - Set secure CORS origins
   - Configure proper rate limiting
   - Use environment-specific JWT secrets
   - Enable helmet security headers
   - Secure Auth0 M2M credentials

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

The API provides several health check endpoints for monitoring:

- `/api/health` - Basic health status
- `/api/health/detailed` - Comprehensive system health (includes Auth0 connectivity)
- `/api/status` - System statistics and metrics

## 🔧 Troubleshooting

### Common Issues

1. **Auth0 Authentication Errors**:
   ```
   Error: oauth.clientCredentialsGrant not available on AuthenticationClient
   ```
   - **Solution**: Ensure you're using Auth0 SDK v4+ and M2M application
   - **Check**: Verify `MASTER_AUTH0_CLIENT_ID` and `MASTER_AUTH0_CLIENT_SECRET`

2. **Management API Access Denied**:
   ```
   Error: Insufficient scope
   ```
   - **Solution**: Grant required scopes to your M2M application in Auth0 Dashboard
   - **Check**: Applications → [Your M2M App] → APIs → Auth0 Management API

3. **Token Validation Errors**:
   ```
   Error: jwt malformed
   ```
   - **Solution**: Verify JWT token format and signing
   - **Check**: Ensure `JWT_SECRET` matches token signing key

4. **Rate Limiting Issues**:
   ```
   Error: Too many requests
   ```
   - **Solution**: Adjust rate limiting configuration
   - **Check**: `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`

### Debug Steps

1. **Check Auth0 Connection**:
   ```bash
   # Test Auth0 connectivity (create a simple test script)
   node -e "
   const Auth0Service = require('./src/services/auth0Service');
   const service = new Auth0Service();
   service.getManagementToken().then(token => 
     console.log('✅ Auth0 connected, token length:', token.length)
   ).catch(console.error);
   "
   ```

2. **Verify Environment Variables**:
   ```bash
   node -e "
   require('dotenv').config();
   const config = require('./src/config');
   console.log('Domain:', config.auth0.master.domain);
   console.log('Client ID:', config.auth0.master.clientId);
   console.log('Audience:', config.auth0.master.managementApiAudience);
   "
   ```

3. **Test API Endpoints**:
   ```bash
   # Health check
   curl http://localhost:3000/api/health
   
   # Detailed health (requires auth)
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/health/detailed
   ```

### Getting Help

- **Health Checks**: Use `/api/health/detailed` for system diagnostics
- **Logs**: Check application logs for detailed error information
- **Mock Mode**: Use `MOCK_AUTH0_API=true` for development testing
- **Auth0 Dashboard**: Verify M2M application configuration and scopes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Changelog

### Version 1.0.0
- Initial release with working Auth0 integration
- Multi-tenant management via Auth0 clients
- Seat-based licensing system
- JWT authentication and authorization
- Role-based access control
- Comprehensive API endpoints
- Health monitoring and diagnostics
- Mock mode for development
- Full test suite with Auth0 integration
- Production-ready error handling and logging