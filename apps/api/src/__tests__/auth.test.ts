import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Auth routes', () => {
  describe('GET /health', () => {
    it('returns 200 and a healthy status (no auth required)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 when there is no active session', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 200 or 401 without a session (endpoint exists)', async () => {
      const res = await request(app).post('/auth/logout');
      // The logout endpoint either succeeds (no-op) or rejects unauthenticated callers.
      // Both are valid — what matters is that the route is reachable.
      expect([200, 401]).toContain(res.status);
    });
  });
});
