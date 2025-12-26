import { describe, expect, it } from 'vitest';
import { parseTelegramUpdate } from '../core/telegramUpdateParser';

describe('parseTelegramUpdate', () => {
  it('parses message text payload', () => {
    const parsed = parseTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        text: 'hello',
        chat: { id: 100, type: 'private' },
        from: { id: 200 }
      }
    });

    expect(parsed.updateType).toBe('message');
    expect(parsed.chatId).toBe(100);
    expect(parsed.fromId).toBe(200);
    expect(parsed.text).toBe('hello');
  });

  it('parses callback_query payload', () => {
    const parsed = parseTelegramUpdate({
      update_id: 2,
      callback_query: {
        id: 'cb1',
        data: 'nav:home',
        from: { id: 300 },
        message: {
          message_id: 11,
          chat: { id: 400, type: 'private' }
        }
      }
    });

    expect(parsed.updateType).toBe('callback_query');
    expect(parsed.chatId).toBe(400);
    expect(parsed.fromId).toBe(300);
    expect(parsed.callbackData).toBe('nav:home');
  });

  it('handles unknown payload safely', () => {
    const parsed = parseTelegramUpdate({ update_id: 3 });
    expect(parsed.updateType).toBe('unknown');
    expect(parsed.chatId).toBeUndefined();
  });
});
