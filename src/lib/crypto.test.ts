import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('Encryption (AES-256-GCM)', () => {
  // Set a test encryption key
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'test').toString('base64');
  });

  it('encrypts and decrypts plaintext correctly', () => {
    const plaintext = 'my-secret-password';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-plaintext';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // Ciphertexts should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same plaintext
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('rejects tampered ciphertext', () => {
    const plaintext = 'sensitive-data';
    const encrypted = encrypt(plaintext);

    // Tamper with the ciphertext (change base64 string)
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[32] ^= 0xff; // Flip bits in the middle
    const tamperedBase64 = tampered.toString('base64');

    expect(() => decrypt(tamperedBase64)).toThrow();
  });

  it('rejects invalid base64', () => {
    expect(() => decrypt('not-valid-base64!')).toThrow();
  });

  it('rejects too-short ciphertext', () => {
    // Ciphertext must be at least IV (16) + authTag (16) bytes
    const tooShort = Buffer.alloc(10).toString('base64');
    expect(() => decrypt(tooShort)).toThrow();
  });

  it('handles empty string', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('handles large strings', () => {
    const plaintext = 'x'.repeat(10000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('handles special characters', () => {
    const plaintext = '🔐 special chars: äöü, 日本語, emoji 🎉';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});
