import { logger } from '../utils/logger';
import fs from 'fs/promises';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const buildUrl = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}/bot${token}/${method}`;

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export const getMe = async (token: string) => {
  const response = await fetch(buildUrl(token, 'getMe'));
  const data = await response.json();

  if (!data.ok) {
    logger.warn({ err: data.description }, 'Telegram getMe failed');
    throw new Error('Invalid bot token');
  }

  return data.result as TelegramUser;
};

export const sendMessage = async (
  token: string,
  chatId: number,
  text: string,
  options?: Record<string, unknown>
) => {
  await fetch(buildUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
};

export const setWebhook = async (
  token: string,
  url: string,
  secretToken?: string
) => {
  const response = await fetch(buildUrl(token, 'setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secretToken })
  });
  const data = await response.json();

  if (!data.ok) {
    logger.warn({ err: data.description }, 'Telegram setWebhook failed');
    throw new Error('Failed to set webhook');
  }
};

export const answerCallbackQuery = async (
  token: string,
  callbackQueryId: string,
  text?: string
) => {
  await fetch(buildUrl(token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
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
  await fetch(buildUrl(token, 'deleteMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
};

export const banChatMember = async (token: string, chatId: number, userId: number) => {
  await fetch(buildUrl(token, 'banChatMember'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId })
  });
};

export const restrictChatMember = async (
  token: string,
  chatId: number,
  userId: number,
  untilDate: number
) => {
  await fetch(buildUrl(token, 'restrictChatMember'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    })
  });
};
