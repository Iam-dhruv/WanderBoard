import { describe, it, expect } from 'vitest';
import {
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
  INVITE_CODE_LENGTH,
} from '@/lib/generateInviteCode';

describe('generateInviteCode', () => {
  it('returns a string of the correct length', () => {
    expect(generateInviteCode()).toHaveLength(INVITE_CODE_LENGTH);
  });

  it('only contains characters from the allowed alphabet', () => {
    const ALLOWED = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).toMatch(ALLOWED);
    }
  });

  it('never contains ambiguous characters (0, O, I, 1, L)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[0OI1L]/);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, generateInviteCode));
    expect(codes.size).toBe(100);
  });
});

describe('isValidInviteCode', () => {
  it('accepts valid codes', () => {
    expect(isValidInviteCode('XJ92L1')).toBe(false); // L is excluded
    expect(isValidInviteCode('XJ92P3')).toBe(true);
    expect(isValidInviteCode('ABCDEF')).toBe(true);
    expect(isValidInviteCode('ABCDHJ')).toBe(true);
  });

  it('rejects codes that are too short or too long', () => {
    expect(isValidInviteCode('ABC')).toBe(false);
    expect(isValidInviteCode('ABCDEFG')).toBe(false);
  });

  it('rejects codes with invalid characters', () => {
    expect(isValidInviteCode('XJ92L1')).toBe(false); // L not in alphabet
    expect(isValidInviteCode('abc123')).toBe(false);  // lowercase not valid
    expect(isValidInviteCode('XXXXXX')).toBe(true);
  });
});

describe('normalizeInviteCode', () => {
  it('trims whitespace', () => {
    expect(normalizeInviteCode('  XJ92P3  ')).toBe('XJ92P3');
  });

  it('uppercases input', () => {
    expect(normalizeInviteCode('xj92p3')).toBe('XJ92P3');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeInviteCode('XJ-92-P3')).toBe('XJ92P3');
  });
});
