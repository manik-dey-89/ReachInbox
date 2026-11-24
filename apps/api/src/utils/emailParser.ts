import type { RecipientInput } from '@reachinbox/shared';

// RFC-5321 simplified regex — covers the overwhelming majority of valid addresses.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Parses a CSV buffer with columns `email` and optionally `name`.
 * Accepts both header rows and plain two-column files.
 * Throws when no valid rows can be found at all.
 */
export function parseCSV(buffer: Buffer): RecipientInput[] {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new Error('CSV file is empty');
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Detect and skip a header row
  let startIndex = 0;
  const firstLineLower = lines[0].toLowerCase();
  if (firstLineLower.startsWith('email') || firstLineLower === 'email,name' || firstLineLower === 'name,email') {
    startIndex = 1;
  }

  const results: RecipientInput[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length === 0 || !parts[0]) continue;

    const email = parts[0];
    const name = parts[1] || undefined;

    if (validateEmail(email)) {
      results.push({ email, name });
    }
  }

  if (results.length === 0 && lines.length > startIndex) {
    throw new Error('CSV file contains no valid email addresses');
  }

  return results;
}

/**
 * Parses a plain-text buffer with one email address per line.
 * Skips blank lines and lines that fail validation.
 */
export function parseTXT(buffer: Buffer): RecipientInput[] {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new Error('TXT file is empty');
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: RecipientInput[] = [];

  for (const line of lines) {
    if (validateEmail(line)) {
      results.push({ email: line });
    }
  }

  if (results.length === 0) {
    throw new Error('TXT file contains no valid email addresses');
  }

  return results;
}

export interface DeduplicateResult {
  valid: RecipientInput[];
  duplicates: string[];
  invalid: string[];
}

/**
 * Deduplicates recipients by email address (case-insensitive).
 * Also separates out any invalid entries that slipped through.
 */
export function deduplicateRecipients(recipients: RecipientInput[]): DeduplicateResult {
  const seen = new Set<string>();
  const valid: RecipientInput[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];

  for (const recipient of recipients) {
    if (!validateEmail(recipient.email)) {
      invalid.push(recipient.email);
      continue;
    }
    const normalised = recipient.email.toLowerCase();
    if (seen.has(normalised)) {
      duplicates.push(recipient.email);
    } else {
      seen.add(normalised);
      valid.push(recipient);
    }
  }

  return { valid, duplicates, invalid };
}
