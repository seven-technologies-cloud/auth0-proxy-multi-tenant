const request = require('supertest');
const app = require('../../src/app');

// Helper to build auth header
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * This E2E spec calls a minimal set of endpoints against real Auth0.
 * Requirements:
 * - Set MOCK_AUTH0_API=false
 * - Ensure MASTER_* and AUTH0_MANAGEMENT_API_AUDIENCE env vars are valid
 * - Provide a real bearer token via env REAL_BEARER_TOKEN (RS256 user JWT)
 */
describe('Real Auth0 E2E (minimal)', () => {
  const token = process.env.REAL_BEARER_TOKEN;

  beforeAll(() => {
    if (!token) {
      throw new Error('REAL_BEARER_TOKEN is not set in environment');
    }
    if (process.env.MOCK_AUTH0_API === 'true') {
      throw new Error('MOCK_AUTH0_API must be false for real E2E');
    }
  });

  test('GET /api/health returns 200 and includes status', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toHaveProperty('status');
  });

  test('GET /api/users/me with real token returns 200 or a well-formed error', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set(authHeader(token));

    // Accept either success (user found) or 401/403 if token lacks necessary claims
    expect([200, 401, 403]).toContain(res.status); 
    expect(res.body).toHaveProperty('success');
  });
});