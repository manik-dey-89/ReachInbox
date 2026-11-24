import { describe, it, expect } from 'vitest';
import { parseCSV, parseTXT, validateEmail, deduplicateRecipients } from '../utils/emailParser';

describe('validateEmail', () => {
  it('returns true for a valid email address', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('returns true for a valid email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.uk')).toBe(true);
  });

  it('returns true for an email with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('returns false for an address missing the @ sign', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('returns false for an address missing the domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('returns false for an address with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('returns false for an address with no TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });
});

describe('parseCSV', () => {
  it('parses a valid CSV with email and name columns', () => {
    const csv = 'email,name\nalice@example.com,Alice\nbob@example.com,Bob';
    const result = parseCSV(Buffer.from(csv));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ email: 'alice@example.com', name: 'Alice' });
    expect(result[1]).toEqual({ email: 'bob@example.com', name: 'Bob' });
  });

  it('parses a CSV without a name column', () => {
    const csv = 'email\nalice@example.com\nbob@example.com';
    const result = parseCSV(Buffer.from(csv));
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('alice@example.com');
  });

  it('skips rows where the email is invalid', () => {
    const csv = 'email,name\nalice@example.com,Alice\nnot-an-email,Bad';
    const result = parseCSV(Buffer.from(csv));
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('alice@example.com');
  });

  it('throws when given an empty buffer', () => {
    expect(() => parseCSV(Buffer.from(''))).toThrow('CSV file is empty');
  });

  it('throws when no valid email addresses are found', () => {
    const csv = 'email\nnot-an-email\nalso-bad';
    expect(() => parseCSV(Buffer.from(csv))).toThrow('CSV file contains no valid email addresses');
  });

  // Formula injection: cells starting with =, +, -, @ can be a spreadsheet injection vector.
  // The parser validates via the email regex, so a cell like "=CMD|' /C calc'!A0" will
  // fail validation and be skipped rather than passed through.
  it('strips formula injection values that start with = (they fail email validation)', () => {
    const csv = 'email,name\n=CMD|calc,Injected\nalice@example.com,Alice';
    const result = parseCSV(Buffer.from(csv));
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('alice@example.com');
  });

  it('strips formula injection values that start with + (they fail email validation)', () => {
    const csv = 'email,name\n+inject(),Injected\nalice@example.com,Alice';
    const result = parseCSV(Buffer.from(csv));
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('alice@example.com');
  });
});

describe('parseTXT', () => {
  it('parses one email per line', () => {
    const txt = 'alice@example.com\nbob@example.com\ncarol@example.com';
    const result = parseTXT(Buffer.from(txt));
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.email)).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
    ]);
  });

  it('ignores blank lines', () => {
    const txt = 'alice@example.com\n\n\nbob@example.com\n';
    const result = parseTXT(Buffer.from(txt));
    expect(result).toHaveLength(2);
  });

  it('skips lines that are not valid emails', () => {
    const txt = 'alice@example.com\nnot-an-email\nbob@example.com';
    const result = parseTXT(Buffer.from(txt));
    expect(result).toHaveLength(2);
  });

  it('throws for an empty buffer', () => {
    expect(() => parseTXT(Buffer.from(''))).toThrow('TXT file is empty');
  });

  it('throws when no valid email is found', () => {
    const txt = 'not-an-email\nalso-bad';
    expect(() => parseTXT(Buffer.from(txt))).toThrow('TXT file contains no valid email addresses');
  });

  it('returns objects with only an email field (no name)', () => {
    const txt = 'alice@example.com';
    const result = parseTXT(Buffer.from(txt));
    expect(result[0]).toEqual({ email: 'alice@example.com' });
  });
});

describe('deduplicateRecipients', () => {
  it('passes through unique recipients unchanged', () => {
    const recipients = [
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
    ];
    const { valid, duplicates, invalid } = deduplicateRecipients(recipients);
    expect(valid).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it('removes duplicate emails (case-insensitive)', () => {
    const recipients = [
      { email: 'alice@example.com' },
      { email: 'Alice@Example.COM' },
    ];
    const { valid, duplicates } = deduplicateRecipients(recipients);
    expect(valid).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toBe('Alice@Example.COM');
  });

  it('puts invalid emails into the invalid array', () => {
    const recipients = [
      { email: 'alice@example.com' },
      { email: 'not-an-email' },
    ];
    const { valid, invalid } = deduplicateRecipients(recipients);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toBe('not-an-email');
  });

  it('handles an empty input array', () => {
    const { valid, duplicates, invalid } = deduplicateRecipients([]);
    expect(valid).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it('keeps the first occurrence when there are duplicates', () => {
    const recipients = [
      { email: 'alice@example.com', name: 'Alice First' },
      { email: 'alice@example.com', name: 'Alice Second' },
    ];
    const { valid } = deduplicateRecipients(recipients);
    expect(valid[0].name).toBe('Alice First');
  });
});
