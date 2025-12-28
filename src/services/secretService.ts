import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../core/encryption';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class SecretService {
    /**
     * Set a secret for a bot. Encrypts the value before storage.
     */
    static async setSecret(botId: string, key: string, value: string): Promise<void> {
        try {
            const { cipherText, iv, tag } = encrypt(value);

            await prisma.botSecret.upsert({
                where: {
                    botId_key: {
                        botId,
                        key
                    }
                },
                update: {
                    value: cipherText,
                    iv,
                    tag,
                },
                create: {
                    botId,
                    key,
                    value: cipherText,
                    iv,
                    tag,
                }
            });

            logger.info(`Secret set for bot ${botId}: ${key}`);
        } catch (error) {
            logger.error(`Failed to set secret ${key} for bot ${botId}`, error);
            throw error;
        }
    }

    /**
     * Get a decrypted secret for a bot.
     */
    static async getSecret(botId: string, key: string): Promise<string | null> {
        try {
            const secret = await prisma.botSecret.findUnique({
                where: {
                    botId_key: {
                        botId,
                        key
                    }
                }
            });

            if (!secret) return null;

            // Ensure we have all parts needed for decryption
            if (!secret.iv || !secret.tag) {
                logger.warn(`Corrupt secret found for bot ${botId}, key ${key} (missing iv/tag)`);
                return null;
            }

            return decrypt(secret.value, secret.iv, secret.tag);
        } catch (error) {
            logger.error(`Failed to retrieve secret ${key} for bot ${botId}`, error);
            return null;
        }
    }

    /**
     * Delete a secret.
     */
    static async deleteSecret(botId: string, key: string): Promise<void> {
        await prisma.botSecret.delete({
            where: {
                botId_key: {
                    botId,
                    key
                }
            }
        });
    }
}
