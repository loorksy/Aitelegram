import { describe, expect, it } from 'vitest';
describe('encryption', () => {
  it('round-trips with AES-256-GCM', () => {
    const payload = 'secret-token';
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
    return import('../core/encryption').then(({ encrypt, decrypt }) => {
      const encrypted = encrypt(payload);
      const decrypted = decrypt(encrypted.cipherText, encrypted.iv, encrypted.tag);
      process.env.ENCRYPTION_KEY = originalKey;
      expect(decrypted).toBe(payload);
    });
  });

  it('fails with invalid tag', () => {
    const payload = 'secret-token';
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
    return import('../core/encryption').then(({ encrypt, decrypt }) => {
      const encrypted = encrypt(payload);
      const badTag = Buffer.from(encrypted.tag, 'base64');
      badTag[0] = badTag[0] ^ 0xff;
      process.env.ENCRYPTION_KEY = originalKey;
      expect(() =>
        decrypt(encrypted.cipherText, encrypted.iv, badTag.toString('base64'))
      ).toThrow();
    });
  });
});
