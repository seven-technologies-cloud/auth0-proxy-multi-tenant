# Auth0 Management API Proxy

A production-ready Node.js REST API for managing Auth0 users and roles via the Auth0 Management API v2. Built with Express, ES modules, and comprehensive security features for multi-tenant environments.

## Table of Contents

- [Features](#features)
- [Security](#security)
- [API Endpoints](#api-endpoints)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Security Considerations](#security-considerations)
- [Monitoring](#monitoring)
- [Architecture](#architecture)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Features

- **🔐 Secure JWT Authentication**: JWKS validation with in-memory caching and rate limiting
- **🛡️ Client ID Allowlist**: Strict validation of authorized Management API clients
- **🔄 Idempotent Operations**: Create-by-email for users, create-by-name for roles with configurable conflict handling
- **👥 Role Management**: Full CRUD operations for Auth0 roles with permission assignment
- **🔗 User-Role Assignments**: Idempotent role assignment/removal with set-difference logic
- **⚠️ Comprehensive Error Handling**: Normalized error responses with correlation IDs
- **🚦 Rate Limiting**: Configurable rate limiting with helmet security headers
- **📝 Request Logging**: Structured logging with pino and correlation ID tracing
- **🎯 Token Caching**: Automatic Management API token refresh with TTL
- **🔄 Retry Logic**: Exponential backoff with jitter for Auth0 API calls
- **📚 Swagger Documentation**: Interactive API documentation at `/docs`
- **💚 Health Checks**: Comprehensive health monitoring at `/health`
- **🏗️ ES Modules**: Modern JavaScript with ES module support
- **🧪 Built-in Testing**: Comprehensive test suite with Node.js test runner

## Security

- All endpoints require valid Bearer JWT tokens issued by Auth0
- JWT validation via JWKS with proper issuer and audience verification
- Client ID allowlist enforcement via environment configuration
- Helmet security headers and strict CORS policy
- Rate limiting and request size limits
- No sensitive data exposure in error responses (production mode)

## API Endpoints

### Users Management
- `GET /users` - Search and list users with pagination
- `GET /users/:id` - Get specific user by ID
- `POST /users` - Create new user (idempotent by email)
- `PATCH /users/:id` - Update user (safe fields only)
- `DELETE /users/:id` - Delete user

### Roles Management
- `GET /roles` - Search and list roles with pagination
- `GET /roles/:id` - Get specific role by ID
- `POST /roles` - Create new role (idempotent by name)
- `PATCH /roles/:id` - Update role (safe fields only)
- `DELETE /roles/:id` - Delete role

### User-Role Assignments
- `GET /users/:id/roles` - Get roles assigned to a user
- `POST /users/:id/roles` - Assign roles to a user (idempotent)
- `DELETE /users/:id/roles` - Remove roles from a user (idempotent)

### System
- `GET /health` - Health check and service status
- `GET /docs` - Swagger API documentation
- `GET /` - API information and available endpoints

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `AUTH0_DOMAIN` - Your Auth0 tenant domain
- `AUTH0_MGMT_CLIENT_ID` - Management API client ID
- `AUTH0_MGMT_CLIENT_SECRET` - Management API client secret
- `MGMT_CLIENT_ALLOWLIST` - Comma-separated list of allowed client IDs

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Run Tests

```bash
npm test
```

## Usage Examples

### 1. Get Management API Token

First, obtain a Management API token using client credentials:

```bash
curl -X POST https://YOUR_DOMAIN.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_MGMT_CLIENT_ID",
    "client_secret": "YOUR_MGMT_CLIENT_SECRET",
    "audience": "https://YOUR_DOMAIN.auth0.com/api/v2/",
    "grant_type": "client_credentials"
  }'
```

### 2. List Users

```bash
curl -X GET "http://localhost:3000/users?page=0&per_page=10&include_totals=true" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Search Users

```bash
# Simple search
curl -X GET "http://localhost:3000/users?search=john" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"

# Advanced Lucene query
curl -X GET "http://localhost:3000/users?q=email:\"john@example.com\"" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 4. Get Specific User

```bash
curl -X GET "http://localhost:3000/users/auth0|123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 5. Create User (Idempotent)

```bash
curl -X POST "http://localhost:3000/users" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "connection": "Username-Password-Authentication",
    "password": "SecurePassword123!",
    "given_name": "John",
    "family_name": "Doe",
    "user_metadata": {
      "department": "Engineering",
      "role": "Developer"
    }
  }'
```

### 6. Update User

```bash
curl -X PATCH "http://localhost:3000/users/auth0|123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "given_name": "Jane",
    "user_metadata": {
      "department": "Marketing",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }'
```

### 7. Delete User

```bash
curl -X DELETE "http://localhost:3000/users/auth0|123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 8. Create Role (Idempotent)

```bash
curl -X POST "http://localhost:3000/roles" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin",
    "description": "Administrator role with full permissions",
    "permissions": [
      {
        "permission_name": "read:users",
        "resource_server_identifier": "https://api.example.com"
      },
      {
        "permission_name": "write:users",
        "resource_server_identifier": "https://api.example.com"
      }
    ]
  }'
```

### 9. List Roles

```bash
curl -X GET "http://localhost:3000/roles?page=0&per_page=10&include_totals=true" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 10. Get Specific Role

```bash
curl -X GET "http://localhost:3000/roles/rol_123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 11. Update Role

```bash
curl -X PATCH "http://localhost:3000/roles/rol_123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated administrator role",
    "permissions": [
      {
        "permission_name": "read:admin",
        "resource_server_identifier": "https://api.example.com"
      }
    ]
  }'
```

### 12. Assign Roles to User (Idempotent)

```bash
curl -X POST "http://localhost:3000/users/auth0|123456789/roles" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["rol_123456789", "rol_987654321"]
  }'
```

### 13. Get User Roles

```bash
curl -X GET "http://localhost:3000/users/auth0|123456789/roles" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 14. Remove Roles from User (Idempotent)

```bash
curl -X DELETE "http://localhost:3000/users/auth0|123456789/roles" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["rol_123456789"]
  }'
```

### 15. Delete Role

```bash
curl -X DELETE "http://localhost:3000/roles/rol_123456789" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

### 16. Health Check

```bash
curl -X GET "http://localhost:3000/health"
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH0_DOMAIN` | Yes | - | Auth0 tenant domain |
| `AUTH0_MGMT_CLIENT_ID` | Yes | - | Management API client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | Yes | - | Management API client secret |
| `MGMT_CLIENT_ALLOWLIST` | Yes | - | Comma-separated allowed client IDs |
| `API_PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `RATE_LIMIT_WINDOW_MS` | No | 60000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | 60 | Max requests per window |
| `ALLOWED_ORIGINS` | No | http://localhost:3000 | CORS allowed origins |
| `IDEMPOTENT_CREATE_MODE` | No | return | 'return' or 'conflict' |

### Idempotent Create Modes

- `return` (default): Return existing user with 200 status
- `conflict`: Return 409 Conflict for existing users

## Project Structure

```
src/
├── app.js                      # Express application setup
├── server.js                   # Server bootstrap and graceful shutdown
├── config/
│   └── env.js                 # Environment configuration and validation
├── controllers/
│   ├── users.controller.js    # User management business logic
│   ├── roles.controller.js    # Role management business logic
│   └── userRoles.controller.js # User-role assignment business logic
├── middleware/
│   ├── authz.js              # JWT validation and authorization
│   ├── error.js              # Centralized error handling
│   └── request-logger.js     # Request logging and correlation IDs
├── routes/
│   ├── users.routes.js       # User API routes with Swagger docs
│   ├── roles.routes.js       # Role API routes with Swagger docs
│   └── userRoles.routes.js   # User-role assignment routes with Swagger docs
├── services/
│   ├── auth0.service.js      # Auth0 Management API client (extended for roles)
│   ├── roles.service.js      # Role management service layer
│   └── userRoles.service.js  # User-role assignment service layer
└── utils/
    ├── retry.js              # Exponential backoff and retry logic
    └── tokenCache.js         # In-memory token caching with TTL
```

## Error Handling

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "correlationId": "uuid-for-tracing"
  }
}
```

Common error codes:
- `MISSING_TOKEN` - No Authorization header provided
- `INVALID_TOKEN` - JWT validation failed
- `CLIENT_NOT_ALLOWED` - Client ID not in allowlist
- `USER_NOT_FOUND` - Requested user doesn't exist
- `USER_EXISTS` - User already exists (conflict mode)
- `ROLE_NOT_FOUND` - Requested role doesn't exist
- `ROLE_EXISTS` - Role already exists (conflict mode)
- `MISSING_ROLE_NAME` - Role name is required
- `INVALID_ROLE_IDS` - Invalid or empty roleIds array
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Logging

The API uses structured logging with pino:

- Request/response logging with correlation IDs
- Error logging with stack traces (development only)
- Auth0 service health monitoring
- Token cache statistics

## Security Considerations

1. **JWT Validation**: All tokens are validated against Auth0's JWKS endpoint
2. **Client Allowlist**: Only pre-approved client IDs can access the API
3. **Field Filtering**: User updates only allow safe, predefined fields
4. **Rate Limiting**: Prevents abuse and DoS attacks
5. **CORS Policy**: Restricts cross-origin requests to approved domains
6. **Error Sanitization**: No sensitive data in error responses (production)
7. **Token Caching**: Management API tokens are cached securely with TTL

## Monitoring

- Health endpoint provides service status and Auth0 connectivity
- Correlation IDs for request tracing across logs
- Token cache statistics and refresh monitoring
- Rate limit and error metrics via structured logging

## Architecture

This API follows a layered architecture pattern:

- **Routes Layer** (`src/routes/`): Express route definitions with Swagger documentation
- **Controllers Layer** (`src/controllers/`): Business logic and request/response handling
- **Services Layer** (`src/services/`): Auth0 API integration and data processing
- **Middleware Layer** (`src/middleware/`): Authentication, logging, and error handling
- **Utils Layer** (`src/utils/`): Shared utilities for caching and retry logic

### Key Dependencies

- **Express.js**: Web framework for API endpoints
- **axios**: HTTP client for Auth0 Management API calls
- **jsonwebtoken & jwks-rsa**: JWT validation and JWKS key management
- **pino**: High-performance structured logging
- **helmet**: Security headers and protection
- **cors**: Cross-origin resource sharing configuration
- **express-rate-limit**: Rate limiting middleware
- **async-retry**: Exponential backoff retry logic
- **swagger-ui-express**: Interactive API documentation
- **supertest**: HTTP testing utilities

## Development

### Prerequisites

- Node.js 18+ (specified in package.json engines)
- Auth0 tenant with Management API application
- Environment variables configured (see `.env.example`)

### Scripts

- `npm run dev` - Start with auto-reload using Node.js `--watch` flag
- `npm start` - Production start
- `npm test` - Run test suite using Node.js built-in test runner

### Testing

The test suite includes:
- Authentication flow testing with JWT validation
- Happy path API operations for users and roles
- Error handling validation with proper error codes
- Rate limiting verification
- CORS policy testing
- Idempotent operation testing

Tests are located in the `test/` directory and use Node.js built-in test runner with supertest for HTTP testing.

### Additional Resources

- **cURL Examples**: See `curl-examples.md` for comprehensive API usage examples
- **Environment Setup**: Copy `.env.example` to `.env` and configure your Auth0 settings
- **API Documentation**: Visit `/docs` endpoint when server is running for interactive Swagger UI

## Production Deployment

### Environment Configuration

Ensure all required environment variables are set:

```bash
# Required
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_MGMT_CLIENT_ID=your_management_api_client_id
AUTH0_MGMT_CLIENT_SECRET=your_management_api_client_secret
MGMT_CLIENT_ALLOWLIST=client_id_1,client_id_2

# Optional (with defaults)
API_PORT=3000
NODE_ENV=production
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
ALLOWED_ORIGINS=https://your-app.com
IDEMPOTENT_CREATE_MODE=return
```

### Production Considerations

1. **Security**:
   - Set `NODE_ENV=production` to enable security features
   - Use HTTPS in production environments
   - Configure proper CORS origins
   - Regularly rotate Auth0 client secrets

2. **Performance**:
   - Token caching reduces Auth0 API calls
   - Rate limiting prevents abuse
   - Retry logic handles transient failures

3. **Monitoring**:
   - Use structured logging for observability
   - Monitor `/health` endpoint for service status
   - Track correlation IDs for request tracing

4. **Scaling**:
   - Stateless design allows horizontal scaling
   - In-memory token cache per instance
   - Consider Redis for shared caching in multi-instance deployments

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the package.json file for details.

## Support

For issues and questions:
- Check the `/health` endpoint for service status
- Review logs with correlation IDs for debugging
- Consult the interactive API documentation at `/docs`
- See `curl-examples.md` for usage examples