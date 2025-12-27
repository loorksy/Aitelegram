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
