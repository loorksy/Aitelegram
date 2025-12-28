import { logger } from '../utils/logger';
import fs from 'fs/promises';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const buildUrl = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}/bot${token}/${method}`;

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

const parseTelegramResponse = async <T>(
  response: Response,
  method: string
): Promise<TelegramApiResponse<T>> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as TelegramApiResponse<T>;
  } catch (err) {
    logger.error(
      { err, status: response.status, body: raw, method },
      'Telegram response was not valid JSON'
    );
    throw new Error(`Telegram ${method} returned invalid JSON`);
  }
};

const requestTelegram = async <T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>
) => {
  logger.info(
    {
      method,
      chatId: payload?.chat_id,
      payloadKeys: payload ? Object.keys(payload) : []
    },
    'Telegram request'
  );
  let response: Response;
  try {
    response = await fetch(buildUrl(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    });
  } catch (err) {
    logger.error({ err, method }, 'Telegram request failed to send');
    throw err;
  }

  const data = await parseTelegramResponse<T>(response, method);
  logger.info(
    { method, status: response.status, ok: data.ok },
    'Telegram response received'
  );

  if (!response.ok || !data.ok) {
    logger.warn(
      { method, status: response.status, error: data.description, code: data.error_code },
      'Telegram request returned error'
    );
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }

  return data;
};

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export const getMe = async (token: string) => {
  const data = await requestTelegram<TelegramUser>(token, 'getMe');
  return data.result as TelegramUser;
};

export const sendMessage = async (
  token: string,
  chatId: number,
  text: string,
  options?: Record<string, unknown>
) => {
  const payload = { chat_id: chatId, text, ...options };
  const data = await requestTelegram<{ message_id: number }>(
    token,
    'sendMessage',
    payload
  );
  return data.result;
};

export const setWebhook = async (
  token: string,
  url: string,
  secretToken?: string
) => {
  await requestTelegram(token, 'setWebhook', {
    url,
    secret_token: secretToken
  });
};

export const answerCallbackQuery = async (
  token: string,
  callbackQueryId: string,
  text?: string
) => {
  await requestTelegram(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
};

export const sendMedia = async ({
  token,
  chatId,
  type,
  filePath,
  caption
}: {
  token: string;
  chatId: number;
  type: 'photo' | 'video' | 'document';
  filePath: string;
  caption?: string;
}) => {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('chat_id', chatId.toString());
  if (caption) {
    form.append('caption', caption);
  }

  const blob = new Blob([buffer]);
  form.append(type, blob, filePath.split('/').pop() ?? 'file');

  await fetch(buildUrl(token, `send${type.charAt(0).toUpperCase()}${type.slice(1)}`), {
    method: 'POST',
    body: form
  });
};

export const deleteMessage = async (token: string, chatId: number, messageId: number) => {
  await requestTelegram(token, 'deleteMessage', {
    chat_id: chatId,
    message_id: messageId
  });
};

export const banChatMember = async (token: string, chatId: number, userId: number) => {
  await requestTelegram(token, 'banChatMember', {
    chat_id: chatId,
    user_id: userId
  });
};

export const restrictChatMember = async (
  token: string,
  chatId: number,
  userId: number,
  untilDate: number
) => {
  await requestTelegram(token, 'restrictChatMember', {
    chat_id: chatId,
    user_id: userId,
    until_date: untilDate,
    permissions: {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    }
  });
};

// ==================== WEBHOOK MANAGEMENT ====================

/**
 * Normalize webhook secret to only contain valid characters [A-Za-z0-9_-]
 * Telegram rejects secrets with +, =, / and other special characters
 */
export const normalizeWebhookSecret = (secret: string): string => {
  // Remove any invalid characters and replace with safe alternatives
  return secret
    .replace(/\+/g, 'P')  // Replace + with P
    .replace(/\//g, 'S')  // Replace / with S
    .replace(/=/g, '')    // Remove = padding
    .replace(/[^A-Za-z0-9_-]/g, ''); // Remove any other invalid chars
};

/**
 * Generate a new valid webhook secret
 */
export const generateWebhookSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validate if a webhook secret is valid for Telegram
 */
export const isValidWebhookSecret = (secret: string): boolean => {
  return /^[A-Za-z0-9_-]+$/.test(secret) && secret.length >= 1 && secret.length <= 256;
};

/**
 * Get webhook secret - normalize if invalid, or generate new one
 */
export const getValidWebhookSecret = (currentSecret?: string): string => {
  if (!currentSecret) {
    return generateWebhookSecret();
  }
  
  if (isValidWebhookSecret(currentSecret)) {
    return currentSecret;
  }
  
  // Try to normalize
  const normalized = normalizeWebhookSecret(currentSecret);
  if (normalized.length >= 8) {
    return normalized;
  }
  
  // Generate new if normalization failed
  return generateWebhookSecret();
};

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Get current webhook info for a bot
 */
export const getWebhookInfo = async (token: string): Promise<WebhookInfo> => {
  const data = await requestTelegram<WebhookInfo>(token, 'getWebhookInfo');
  return data.result as WebhookInfo;
};

/**
 * Set webhook with validation and auto-normalized secret
 * Returns detailed result including webhook verification
 */
export const setWebhookWithValidation = async (
  token: string,
  url: string,
  secretToken?: string
): Promise<{
  success: boolean;
  webhookUrl: string;
  secret: string;
  error?: string;
  webhookInfo?: WebhookInfo;
}> => {
  // Get valid secret
  const validSecret = getValidWebhookSecret(secretToken);
  
  try {
    // Set the webhook
    await requestTelegram(token, 'setWebhook', {
      url,
      secret_token: validSecret,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
    });
    
    // Verify webhook was set correctly
    const webhookInfo = await getWebhookInfo(token);
    
    if (webhookInfo.url !== url) {
      return {
        success: false,
        webhookUrl: url,
        secret: validSecret,
        error: `Webhook URL mismatch. Expected: ${url}, Got: ${webhookInfo.url}`,
        webhookInfo
      };
    }
    
    if (webhookInfo.last_error_message) {
      return {
        success: false,
        webhookUrl: url,
        secret: validSecret,
        error: `Webhook has error: ${webhookInfo.last_error_message}`,
        webhookInfo
      };
    }
    
    return {
      success: true,
      webhookUrl: url,
      secret: validSecret,
      webhookInfo
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      webhookUrl: url,
      secret: validSecret,
      error: errorMessage
    };
  }
};

/**
 * Delete webhook for a bot
 */
export const deleteWebhook = async (token: string): Promise<boolean> => {
  try {
    await requestTelegram(token, 'deleteWebhook', { drop_pending_updates: false });
    return true;
  } catch {
    return false;
  }
};
