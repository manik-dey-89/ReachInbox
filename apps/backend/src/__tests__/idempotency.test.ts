import { describe, it, expect } from 'vitest';
import { generateBullJobId, generateIdempotencyKey } from '../utils/idempotency';

describe('generateBullJobId', () => {
  it('returns the same string when called with the same inputs', () => {
    const a = generateBullJobId('campaign-123', 'recipient-456');
    const b = generateBullJobId('campaign-123', 'recipient-456');
    expect(a).toBe(b);
  });

  it('returns different strings for different campaign IDs', () => {
    const a = generateBullJobId('campaign-aaa', 'recipient-456');
    const b = generateBullJobId('campaign-bbb', 'recipient-456');
    expect(a).not.toBe(b);
  });

  it('returns different strings for different recipient IDs', () => {
    const a = generateBullJobId('campaign-123', 'recipient-aaa');
    const b = generateBullJobId('campaign-123', 'recipient-bbb');
    expect(a).not.toBe(b);
  });

  it('contains the campaign ID so the job can be traced back to its campaign', () => {
    const jobId = generateBullJobId('campaign-123', 'recipient-456');
    expect(jobId).toContain('campaign-123');
  });

  it('contains the recipient ID so the job can be traced back to the recipient', () => {
    const jobId = generateBullJobId('campaign-123', 'recipient-456');
    expect(jobId).toContain('recipient-456');
  });

  it('returns a non-empty string', () => {
    const jobId = generateBullJobId('c1', 'r1');
    expect(typeof jobId).toBe('string');
    expect(jobId.length).toBeGreaterThan(0);
  });
});

describe('generateIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    const key = generateIdempotencyKey('campaign-1', 'recipient-1');
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('is stable — same inputs produce the same key', () => {
    const a = generateIdempotencyKey('campaign-1', 'recipient-1');
    const b = generateIdempotencyKey('campaign-1', 'recipient-1');
    expect(a).toBe(b);
  });

  it('differs when campaign ID changes', () => {
    const a = generateIdempotencyKey('campaign-1', 'recipient-1');
    const b = generateIdempotencyKey('campaign-2', 'recipient-1');
    expect(a).not.toBe(b);
  });

  it('differs when recipient ID changes', () => {
    const a = generateIdempotencyKey('campaign-1', 'recipient-1');
    const b = generateIdempotencyKey('campaign-1', 'recipient-2');
    expect(a).not.toBe(b);
  });
});
