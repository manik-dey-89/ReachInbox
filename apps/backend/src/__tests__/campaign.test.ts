import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Campaign routes — auth middleware protection', () => {
  it('POST /api/campaigns without session returns 401', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ subject: 'Test', body: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('GET /api/campaigns without session returns 401', async () => {
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(401);
  });

  it('GET /api/dashboard/stats without session returns 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('GET /api/campaigns/:id without session returns 401', async () => {
    const res = await request(app).get('/api/campaigns/nonexistent-id');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/campaigns/:id without session returns 401', async () => {
    const res = await request(app).delete('/api/campaigns/nonexistent-id');
    expect(res.status).toBe(401);
  });
});
