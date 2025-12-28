export type UpdateType = 'message' | 'callback_query' | 'unknown';

export interface ParsedUpdate {
  updateType: UpdateType;
  chatId?: number;
  fromId?: number;
  text?: string;
  callbackData?: string;
  updateId?: number;
  messageId?: number;
  chatType?: string;
}

export const parseTelegramUpdate = (update: Record<string, unknown>): ParsedUpdate => {
  const updateId = typeof update.update_id === 'number' ? update.update_id : undefined;
  const message = update.message as Record<string, unknown> | undefined;
  const callback = update.callback_query as Record<string, unknown> | undefined;

  if (message) {
    const chat = message.chat as Record<string, unknown> | undefined;
    const from = message.from as Record<string, unknown> | undefined;
    return {
      updateType: 'message',
      updateId,
      chatId: typeof chat?.id === 'number' ? (chat.id as number) : undefined,
      chatType: typeof chat?.type === 'string' ? (chat.type as string) : undefined,
      fromId: typeof from?.id === 'number' ? (from.id as number) : undefined,
      text: typeof message.text === 'string' ? (message.text as string) : undefined,
      messageId: typeof message.message_id === 'number' ? (message.message_id as number) : undefined
    };
  }

  if (callback) {
    const messageObj = callback.message as Record<string, unknown> | undefined;
    const chat = messageObj?.chat as Record<string, unknown> | undefined;
    const from = callback.from as Record<string, unknown> | undefined;
    return {
      updateType: 'callback_query',
      updateId,
      chatId: typeof chat?.id === 'number' ? (chat.id as number) : undefined,
      chatType: typeof chat?.type === 'string' ? (chat.type as string) : undefined,
      fromId: typeof from?.id === 'number' ? (from.id as number) : undefined,
      callbackData: typeof callback.data === 'string' ? (callback.data as string) : undefined,
      messageId: typeof messageObj?.message_id === 'number' ? (messageObj.message_id as number) : undefined
    };
  }

  return { updateType: 'unknown', updateId };
};
