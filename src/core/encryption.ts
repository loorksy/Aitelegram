import crypto from 'crypto';
import { env } from '../config/env';

const getKey = () => {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64)');
  }
  return key;
};

export const encrypt = (plainText: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
};

export const decrypt = (cipherText: string, iv: string, tag: string) => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
