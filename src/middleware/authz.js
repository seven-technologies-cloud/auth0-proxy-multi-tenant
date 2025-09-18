import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import config from '../config/env.js';

/**
 * JWKS client with caching and rate limiting
 * Caches signing keys in memory and rate limits requests to JWKS endpoint
 */
const client = jwksClient({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

/**
 * Get signing key for JWT verification
 * @param {object} header - JWT header
 * @param {function} callback - Callback function
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * JWT Authorization middleware
 * Validates JWT tokens using JWKS, checks issuer, audience, and client_id allowlist
 */
export function authorize(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || req.correlationId;
  
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization header with Bearer token is required',
          correlationId,
        },
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT with JWKS
    jwt.verify(token, getKey, {
      audience: config.auth0.audience,
      issuer: config.auth0.issuer,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) {
        let errorCode = 'INVALID_TOKEN';
        let errorMessage = 'Invalid or expired token';

        if (err.name === 'TokenExpiredError') {
          errorCode = 'TOKEN_EXPIRED';
          errorMessage = 'Token has expired';
        } else if (err.name === 'JsonWebTokenError') {
          errorCode = 'MALFORMED_TOKEN';
          errorMessage = 'Malformed token';
        } else if (err.name === 'NotBeforeError') {
          errorCode = 'TOKEN_NOT_ACTIVE';
          errorMessage = 'Token not active';
        }

        return res.status(401).json({
          error: {
            code: errorCode,
            message: errorMessage,
            correlationId,
          },
        });
      }

      // Validate issuer (double-check even though jwt.verify checks this)
      if (decoded.iss !== config.auth0.issuer) {
        return res.status(401).json({
          error: {
            code: 'INVALID_ISSUER',
            message: `Invalid token issuer. Expected: ${config.auth0.issuer}`,
            correlationId,
          },
        });
      }

      // Validate audience (double-check even though jwt.verify checks this)
      const tokenAudience = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
      if (!decoded.aud || !tokenAudience.includes(config.auth0.audience)) {
        return res.status(401).json({
          error: {
            code: 'INVALID_AUDIENCE',
            message: `Invalid token audience. Expected: ${config.auth0.audience}`,
            correlationId,
          },
        });
      }

      // Get client ID from token (Auth0 uses 'azp' field for client_id)
      const clientId = decoded.client_id || decoded.azp;
      
      // Validate client_id against allowlist
      if (!clientId || !config.security.mgmtClientAllowlist.includes(clientId)) {
        return res.status(403).json({
          error: {
            code: 'CLIENT_NOT_ALLOWED',
            message: 'Client ID not in allowlist',
            details: {
              clientId: clientId,
              allowedClients: config.security.mgmtClientAllowlist,
            },
            correlationId,
          },
        });
      }

      // Add decoded token to request for use in controllers
      req.auth = {
        token: decoded,
        clientId: clientId,
        scopes: decoded.scope ? decoded.scope.split(' ') : [],
      };

      next();
    });
  } catch (error) {
    console.error('Authorization middleware error:', error);
    return res.status(500).json({
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Internal authorization error',
        correlationId,
      },
    });
  }
}

/**
 * Optional authorization middleware for health checks
 * Allows unauthenticated access to health endpoint
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    return next();
  }

  // Token provided, validate it
  authorize(req, res, next);
}